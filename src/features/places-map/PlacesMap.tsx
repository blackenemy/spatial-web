/**
 * PlacesMap — MapLibre GL map with place markers (view-only)
 * Markers are clickable to select a place.
 * When addMode is true, clicking the map picks a location.
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import Map, { Marker, NavigationControl, Source, Layer, type MapRef } from 'react-map-gl/maplibre';
import Supercluster from 'supercluster';
import { InputGroup, Button } from '@blueprintjs/core';
import { CiMapPin } from 'react-icons/ci';
import { useListPlaces } from '../../hooks/usePlaces';
import { PLACE_TYPE_CONFIG } from '../../components/PlaceTypeIcon';
import type { PlaceType } from '../../types/api';
import type { FeatureCollection, Geometry } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';

// ponytail: raster basemaps that need no API key. To add one, add a row here.
const rasterStyle = (tiles: string[], attribution: string) => ({
  version: 8 as const,
  sources: { base: { type: 'raster' as const, tiles, tileSize: 256, attribution } },
  layers: [{ id: 'base', type: 'raster' as const, source: 'base' }],
});

const BASEMAPS = {
  street: {
    label: 'Street',
    style: rasterStyle(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], '© OpenStreetMap contributors'),
  },
  satellite: {
    label: 'Satellite',
    style: rasterStyle(
      ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      '© Esri, Maxar, Earthstar Geographics'
    ),
  },
  dark: {
    label: 'Dark',
    style: rasterStyle(['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'], '© CARTO © OpenStreetMap contributors'),
  },
} as const;

type BasemapKey = keyof typeof BASEMAPS;

interface Props {
  selectedPlaceId: string | null;
  onSelectPlace: (id: string | null) => void;
  addMode: boolean;
  pendingCoords: [number, number] | null;
  onPickLocation: (lng: number, lat: number) => void;
  urlLoadingInput: string;
  onUrlLoadingInputChange: (url: string) => void;
  onLoadFromUrl: () => void;
  isLoadingFromUrl: boolean;
}

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

export default function PlacesMap({
  selectedPlaceId,
  onSelectPlace,
  addMode,
  pendingCoords,
  onPickLocation,
  urlLoadingInput,
  onUrlLoadingInputChange,
  onLoadFromUrl,
  isLoadingFromUrl,
}: Props) {
  // ponytail: initial view centered on Bangkok (13.7563, 100.5018)
  const [viewState, setViewState] = useState<ViewState>({
    longitude: 100.5018,
    latitude: 13.7563,
    zoom: 11,
  });

  const [basemap, setBasemap] = useState<BasemapKey>('street');
  // west, south, east, north — updated from the map on load/move for clustering
  const [bbox, setBbox] = useState<[number, number, number, number] | null>(null);
  const mapRef = useRef<MapRef>(null);

  const { data } = useListPlaces();
  const features = data?.features || [];

  // ponytail: split by geometry type — Points for clustering, non-Points for vector layers
  const pointFeatures = useMemo(() => features.filter((f) => f.geometry.type === 'Point'), [features]);
  const nonPointFeatures = useMemo(() => features.filter((f) => f.geometry.type !== 'Point'), [features]);

  // Build a supercluster index from Point features only
  const cluster = useMemo(() => {
    const index = new Supercluster<{ featureId: string; placeType: PlaceType }>({
      radius: 60,
      maxZoom: 16,
    });
    index.load(
      pointFeatures.map((f) => ({
        type: 'Feature' as const,
        properties: { featureId: f.id, placeType: f.properties.type },
        geometry: { type: 'Point' as const, coordinates: (f.geometry as any).coordinates },
      }))
    );
    return index;
  }, [pointFeatures]);

  // GeoJSON source for non-Point features with id and type in properties for styling
  const nonPointGeoJson: FeatureCollection = useMemo(
    () => ({
      type: 'FeatureCollection',
      features: nonPointFeatures.map((f) => ({
        type: 'Feature' as const,
        id: f.id,
        geometry: f.geometry,
        properties: {
          id: f.id,
          type: f.properties.type,
        },
      })),
    }),
    [nonPointFeatures]
  );

  const clusters = useMemo(
    () => (bbox ? cluster.getClusters(bbox, Math.floor(viewState.zoom)) : []),
    [cluster, bbox, viewState.zoom]
  );

  const syncBbox = () => {
    const b = mapRef.current?.getMap().getBounds();
    if (b) setBbox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  };

  // Update feature-state for non-Point feature highlighting on selection change
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Clear previous selection state from all non-Point features
    nonPointFeatures.forEach((f) => {
      map.setFeatureState({ source: 'non-point-source', id: f.id }, { selected: false });
    });

    // Set selected state on the newly selected feature (if it's non-Point)
    if (selectedPlaceId) {
      const feature = nonPointFeatures.find((f) => f.id === selectedPlaceId);
      if (feature) {
        map.setFeatureState({ source: 'non-point-source', id: feature.id }, { selected: true });
      }
    }
  }, [selectedPlaceId, nonPointFeatures]);

  const handleMapClick = (e: any) => {
    // Check if a non-Point feature was clicked
    if (!addMode && e.features && e.features.length > 0) {
      const feature = e.features.find((f: any) => ['fill-layer', 'line-layer'].includes(f.layer.id));
      if (feature) {
        onSelectPlace(feature.properties.id);
        return;
      }
    }

    // In add mode, pick location (Points only)
    if (!addMode) return;
    const [lng, lat] = e.lngLat;
    onPickLocation(lng, lat);
  };

  // Compute bbox from geometry coordinates for fitBounds
  const computeBbox = (geom: Geometry): [number, number, number, number] | null => {
    const coords: number[][] = [];
    const traverse = (c: any): void => {
      if (Array.isArray(c)) {
        if (typeof c[0] === 'number') {
          coords.push(c);
        } else {
          c.forEach(traverse);
        }
      }
    };
    // ponytail: cast coordinates access to any; Geometry is a union, coordinates only on Point/LineString/Polygon
    traverse((geom as any).coordinates);
    if (coords.length === 0) return null;
    const lngs = coords.map((p) => p[0]);
    const lats = coords.map((p) => p[1]);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  };

  // Fly to selected place (from sidebar detail click)
  useEffect(() => {
    if (selectedPlaceId) {
      const feature = features.find((f) => f.id === selectedPlaceId);
      if (feature) {
        // Points: fly to point
        if (feature.geometry.type === 'Point') {
          const [lng, lat] = (feature.geometry as any).coordinates;
          setViewState((v) => ({ ...v, longitude: lng, latitude: lat, zoom: 15 }));
        } else {
          // Non-Point: fit bounds
          const bbox = computeBbox(feature.geometry);
          if (bbox && mapRef.current) {
            const [west, south, east, north] = bbox;
            mapRef.current.fitBounds(
              [
                [west, south],
                [east, north],
              ],
              { padding: 50 }
            );
          }
        }
      }
    }
  }, [selectedPlaceId, features]);

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          syncBbox();
        }}
        onLoad={syncBbox}
        onClick={handleMapClick}
        style={{ width: '100%', height: '100%' }}
        mapStyle={BASEMAPS[basemap].style}
        interactiveLayerIds={['fill-layer', 'line-layer']}
      >
        <NavigationControl position="top-right" />

        {/* Non-Point features: GeoJSON source with fill and line layers */}
        <Source id="non-point-source" type="geojson" data={nonPointGeoJson}>
          {/* Fill layer for Polygon/MultiPolygon */}
          <Layer
            id="fill-layer"
            type="fill"
            paint={
              {
                'fill-color': [
                  'match',
                  ['get', 'type'],
                  ...Object.entries(PLACE_TYPE_CONFIG).flatMap(([type, config]) => [type, config.color]),
                  '#5F6B7C', // default for unknown types
                ] as any,
                'fill-opacity': 0,
              } as any
            }
            filter={['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]] as any}
          />

          {/* Line layer for LineString/MultiLineString and polygon outlines */}
          <Layer
            id="line-layer"
            type="line"
            paint={
              {
                'line-color': [
                  'match',
                  ['get', 'type'],
                  ...Object.entries(PLACE_TYPE_CONFIG).flatMap(([type, config]) => [type, config.color]),
                  '#5F6B7C', // default for unknown types
                ] as any,
                'line-width': [
                  'case',
                  ['feature-state', 'selected'],
                  3,
                  2,
                ] as any,
                'line-opacity': [
                  'case',
                  ['feature-state', 'selected'],
                  1,
                  0.7,
                ] as any,
              } as any
            }
            filter={['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]] as any}
          />

          {/* Outline for Polygon/MultiPolygon */}
          <Layer
            id="polygon-outline-layer"
            type="line"
            paint={
              {
                'line-color': [
                  'match',
                  ['get', 'type'],
                  ...Object.entries(PLACE_TYPE_CONFIG).flatMap(([type, config]) => [type, config.color]),
                  '#5F6B7C', // default for unknown types
                ] as any,
                'line-width': [
                  'case',
                  ['feature-state', 'selected'],
                  3,
                  1.5,
                ] as any,
                'line-opacity': [
                  'case',
                  ['feature-state', 'selected'],
                  1,
                  0.8,
                ] as any,
              } as any
            }
            filter={['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]] as any}
          />
        </Source>

        {clusters.map((c) => {
          const [lng, lat] = c.geometry.coordinates;
          // supercluster returns a union (cluster | point); narrow via a cast
          const props = c.properties as {
            cluster?: boolean;
            point_count?: number;
            featureId?: string;
            placeType?: PlaceType;
          };

          // Cluster bubble: count, size scales with count; click zooms in to expand
          if (props.cluster) {
            const count = props.point_count ?? 0;
            const size = 28 + Math.min(count, 12) * 2;
            return (
              <Marker key={`cluster-${c.id}`} longitude={lng} latitude={lat}>
                <div
                  onClick={() => {
                    const zoom = cluster.getClusterExpansionZoom(c.id as number);
                    setViewState((v) => ({ ...v, longitude: lng, latitude: lat, zoom }));
                  }}
                  style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: 'rgba(45,114,210,0.85)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {count}
                </div>
              </Marker>
            );
          }

          // Single place: keep the Blueprint icon + selection/scale behavior
          const id = props.featureId!;
          const isSelected = id === selectedPlaceId;
          const config = PLACE_TYPE_CONFIG[props.placeType!];
          return (
            <Marker
              key={id}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                onSelectPlace(id);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* ponytail: white circular badge behind the line icon so it reads on any basemap.
                  scale on the wrapper, NOT the Marker — react-map-gl owns the Marker's transform. */}
              <div
                style={{
                  transform: isSelected ? 'scale(1.35)' : 'scale(1)',
                  transition: 'transform 0.2s',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#fff',
                  border: `2px solid ${config.color}`,
                  boxShadow: isSelected
                    ? `0 0 0 3px ${config.color}55, 0 1px 5px rgba(0,0,0,0.4)`
                    : '0 1px 5px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <config.Icon color={config.color} size={20} />
              </div>
            </Marker>
          );
        })}

        {pendingCoords && (
          <Marker longitude={pendingCoords[0]} latitude={pendingCoords[1]} anchor="center">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#fff',
                border: '2px solid #CD4246',
                boxShadow: '0 1px 5px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CiMapPin color="#CD4246" size={20} />
            </div>
          </Marker>
        )}
      </Map>

      {/* Basemap thumbnail switcher (top-left) */}
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1000 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(BASEMAPS).map(([key, b]) => {
            const isActive = basemap === key;
            // ponytail: static basemap preview tiles — representative 5/25/14 tiles for each
            const previewTiles: Record<BasemapKey, string> = {
              street: 'https://tile.openstreetmap.org/5/16/10.png',
              satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/10/16',
              dark: 'https://a.basemaps.cartocdn.com/dark_all/5/16/10.png',
            };
            return (
              <button
                key={key}
                onClick={() => setBasemap(key as BasemapKey)}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 4,
                  border: isActive ? '3px solid rgba(45,114,210,0.8)' : '1px solid rgba(17,20,24,0.2)',
                  padding: 0,
                  cursor: 'pointer',
                  backgroundImage: `url('${previewTiles[key as BasemapKey]}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transition: 'border 0.2s',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.1)',
                  position: 'relative',
                }}
                title={b.label}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 2,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: 9,
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                      fontWeight: 600,
                      pointerEvents: 'none',
                    }}
                  >
                    {b.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Load GeoJSON from URL (top center) */}
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, maxWidth: 400 }}>
        <div style={{ display: 'flex', gap: 8, background: '#fff', padding: 8, borderRadius: 4, boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
          <InputGroup
            placeholder="Paste GeoJSON URL..."
            value={urlLoadingInput}
            onValueChange={onUrlLoadingInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onLoadFromUrl();
              }
            }}
            style={{ flex: 1, minWidth: 200 }}
          />
          <Button
            icon="cloud-download"
            loading={isLoadingFromUrl}
            onClick={onLoadFromUrl}
            disabled={!urlLoadingInput.trim() || isLoadingFromUrl}
            intent="primary"
            title="Load places from URL"
          />
        </div>
      </div>
    </div>
  );
}
