/**
 * Geometry utilities for handling GeoJSON geometries safely
 */
import type { Geometry } from 'geojson';

export function isPoint(geometry: Geometry): geometry is { type: 'Point'; coordinates: [number, number] } {
  return geometry.type === 'Point';
}

export function getPointCoordinates(
  geometry: Geometry
): [number, number] | null {
  if (geometry.type === 'Point') {
    const coords = geometry.coordinates as [number, number];
    return coords;
  }
  return null;
}

export function getGeometryLabel(geometry: Geometry): string {
  const typeLabels: Record<string, string> = {
    Point: 'Point',
    LineString: 'LineString',
    Polygon: 'Polygon',
    MultiPoint: 'MultiPoint',
    MultiLineString: 'MultiLineString',
    MultiPolygon: 'MultiPolygon',
    GeometryCollection: 'Collection',
  };
  return typeLabels[geometry.type] || geometry.type;
}
