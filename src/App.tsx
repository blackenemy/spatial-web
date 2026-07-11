/**
 * App — main layout: map-dominant with floating sidebar hub + responsive mobile toggle
 */

import { useRef, useState } from 'react';
import { Navbar, Alignment, Icon, Button, ButtonGroup, Dialog, TextArea, InputGroup, HTMLSelect } from '@blueprintjs/core';
import { toast } from './toaster';
import Sidebar, { type SidebarView } from './features/sidebar/Sidebar';
import PlacesTable from './features/places-table/PlacesTable';
import PlacesMap from './features/places-map/PlacesMap';
import { PlaceLegend } from './components/PlaceTypeIcon';
import { useCreatePlace, useListPlaces } from './hooks/usePlaces';
import { placesApi } from './api/client';
import { PLACE_TYPE_CONFIG } from './components/PlaceTypeIcon';
import type { PlaceType, CreatePlaceDto } from './types/api';
import type { Feature, Geometry } from 'geojson';

const VALID_TYPES = Object.keys(PLACE_TYPE_CONFIG) as PlaceType[];
const VALID_GEOMETRY_TYPES = ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon'];

function featureToDto(f: any): CreatePlaceDto | null {
  if (f?.type !== 'Feature') return null;
  const geom = f.geometry as Geometry | null;
  if (!geom || !VALID_GEOMETRY_TYPES.includes(geom.type)) return null;
  // GeometryCollection is not valid; coordinates exist on Point, LineString, Polygon, Multi*
  if (geom.type === 'GeometryCollection') return null;
  const coords = (geom as any).coordinates as any;
  if (!Array.isArray(coords) || coords.length === 0) return null;

  // Real-world GeoJSON uses varied property casing (NAME, Name, name). Look up case-insensitively.
  const props = f.properties ?? {};
  const lower: Record<string, unknown> = {};
  for (const k of Object.keys(props)) lower[k.toLowerCase()] = props[k];
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = lower[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  };

  const name = (pick('name', 'title', 'lv_label', 'label') ?? 'Imported place').slice(0, 120);

  // Match the source type to our enum by substring (e.g. "Reading Cafe" -> cafe), else 'other'.
  const rawType = (pick('type') ?? '').toLowerCase();
  const type: PlaceType = VALID_TYPES.find((t) => rawType.includes(t)) ?? 'other';

  // Build a description from whatever context fields exist.
  const description =
    pick('description', 'address', 'addr') ??
    [pick('phone'), pick('email')].filter(Boolean).join(' · ') ??
    null;

  return {
    name,
    type,
    description: description || null,
    geometry: geom,
  };
}

function flattenFeature(f: Feature): Feature[] {
  if (f.geometry.type !== 'GeometryCollection') return [f];
  // ponytail: GeometryCollection support; create one Feature per member geometry
  const { properties } = f;
  return (f.geometry.geometries || []).map((geom) => ({
    type: 'Feature' as const,
    properties,
    geometry: geom,
  }));
}

async function ingestGeoJson(text: string, createMutation: any): Promise<number> {
  // Parse JSON (bare Geometry, Feature, or FeatureCollection)
  const json = JSON.parse(text);
  let features: Feature[] = [];

  if (json?.type === 'FeatureCollection') {
    features = json.features ?? [];
  } else if (json?.type === 'Feature') {
    features = [json];
  } else if (json?.type && VALID_GEOMETRY_TYPES.includes(json.type)) {
    // Bare geometry → wrap in Feature
    features = [{ type: 'Feature' as const, properties: {}, geometry: json }];
  }

  let ok = 0, skipped = 0;
  for (const f of features) {
    // Flatten GeometryCollection
    const flattened = flattenFeature(f);
    for (const feat of flattened) {
      const dto = featureToDto(feat);
      if (!dto) { skipped++; continue; }
      try { await createMutation.mutateAsync(dto); ok++; } catch { skipped++; }
    }
  }

  if (ok > 0) {
    toast.success(`Imported ${ok} place(s)${skipped ? `, skipped ${skipped}` : ''}`);
  } else {
    toast.warning(skipped ? `Skipped ${skipped} invalid features` : 'No valid features found');
  }

  return ok;
}

export default function App() {
  const [sidebarView, setSidebarView] = useState<SidebarView>('list');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [pendingCoords, setPendingCoords] = useState<[number, number] | null>(null);
  const [mobileShowSidebar, setMobileShowSidebar] = useState(true);
  const [importingGeoJson, setImportingGeoJson] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawVertices, setDrawVertices] = useState<[number, number][]>([]);
  const [areaResults, setAreaResults] = useState<any[] | null>(null);
  const [areaLoading, setAreaLoading] = useState(false);
  const [savePolyOpen, setSavePolyOpen] = useState(false);
  const [polyName, setPolyName] = useState('');
  const [polyType, setPolyType] = useState<PlaceType>('attraction');

  const clearArea = () => {
    setDrawMode(false);
    setDrawVertices([]);
    setAreaResults(null);
  };

  const searchArea = async () => {
    if (drawVertices.length < 3) return;
    setAreaLoading(true);
    try {
      const polygon = { type: 'Polygon' as const, coordinates: [[...drawVertices, drawVertices[0]]] };
      const fc = await placesApi.within(polygon);
      setAreaResults(fc.features);
      toast.success(`พบ ${fc.features.length} สถานที่ในพื้นที่นี้`);
    } catch (e) {
      toast.danger('ค้นหาพื้นที่ล้มเหลว: ' + (e as Error).message);
    } finally {
      setAreaLoading(false);
      setDrawMode(false);
    }
  };

  const handleSelectPlace = (id: string | null) => {
    setSelectedPlaceId(id);
    if (id) {
      setSidebarView('detail');
      // Surface the panel — a marker click is useless if the detail lands in a
      // collapsed (desktop) or hidden (mobile shows the map) sidebar.
      setSidebarCollapsed(false);
      setMobileShowSidebar(true);
    }
  };
  const [urlLoadingInput, setUrlLoadingInput] = useState('');
  const [loadingFromUrl, setLoadingFromUrl] = useState(false);
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteInputValue, setPasteInputValue] = useState('');
  const [pasteLoading, setPasteLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useListPlaces();
  const createMutation = useCreatePlace();

  const saveDrawnPolygon = async () => {
    if (drawVertices.length < 3 || !polyName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: polyName.trim(),
        type: polyType,
        geometry: { type: 'Polygon', coordinates: [[...drawVertices, drawVertices[0]]] },
      });
      toast.success('บันทึกพื้นที่เป็นสถานที่แล้ว');
      setSavePolyOpen(false);
      setPolyName('');
      clearArea();
    } catch (e) {
      toast.danger('บันทึกล้มเหลว: ' + (e as Error).message);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `places-${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('GeoJSON exported');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportingGeoJson(true);
    try {
      await ingestGeoJson(await file.text(), createMutation);
    } catch {
      toast.danger('Invalid GeoJSON file');
    } finally {
      setImportingGeoJson(false);
    }
  };

  const handleLoadFromUrl = async () => {
    if (!urlLoadingInput.trim()) return;
    setLoadingFromUrl(true);
    try {
      const response = await fetch(urlLoadingInput);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      await ingestGeoJson(await response.text(), createMutation);
      setUrlLoadingInput('');
    } catch (err) {
      toast.danger(`Failed to load GeoJSON: ${(err as Error).message} (CORS may block some hosts)`);
    } finally {
      setLoadingFromUrl(false);
    }
  };

  const handlePasteLoad = async () => {
    if (!pasteInputValue.trim()) return;
    setPasteLoading(true);
    try {
      await ingestGeoJson(pasteInputValue, createMutation);
      setPasteInputValue('');
      setPasteDialogOpen(false);
    } catch {
      toast.danger('Invalid GeoJSON');
    } finally {
      setPasteLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <Navbar>
        <Navbar.Group align={Alignment.LEFT}>
          <Icon icon="map" style={{ marginRight: 8 }} />
          <Navbar.Heading>Mini Spatial Data Platform</Navbar.Heading>
          <Navbar.Divider />
          <span className="bp6-text-muted">Manage places on an interactive map</span>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button
            icon="import"
            minimal
            loading={importingGeoJson}
            onClick={() => fileRef.current?.click()}
            title="Import places from GeoJSON file"
          >
            Import
          </Button>
          <Button
            icon="clipboard"
            minimal
            onClick={() => setPasteDialogOpen(true)}
            title="Paste GeoJSON"
          >
            Paste
          </Button>
          <Button
            icon="export"
            minimal
            onClick={handleExport}
            disabled={!data?.features.length}
            title="Export all places as GeoJSON"
          >
            Export
          </Button>
          <Navbar.Divider />
          <Button
            icon="th-derived"
            minimal
            active={tableOpen}
            onClick={() => setTableOpen(!tableOpen)}
            title="Toggle table view"
          >
            Table
          </Button>
          <Button
            icon="polygon-filter"
            minimal
            active={drawMode}
            onClick={() => {
              if (drawMode) clearArea();
              else { setDrawVertices([]); setAreaResults(null); setDrawMode(true); }
            }}
            title="วาดพื้นที่บนแผนที่เพื่อค้นหาสถานที่ข้างใน"
          >
            Area
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".geojson,application/geo+json,application/json"
            style={{ display: 'none' }}
            onChange={handleImport}
          />
        </Navbar.Group>

        {/* Paste GeoJSON Dialog */}
        <Dialog
          isOpen={pasteDialogOpen}
          onClose={() => setPasteDialogOpen(false)}
          title="Paste GeoJSON"
          className="bp6-dialog"
        >
          <div className="bp6-dialog-body">
            <TextArea
              fill
              placeholder="Paste GeoJSON (FeatureCollection, Feature, or Geometry)..."
              value={pasteInputValue}
              onChange={(e) => setPasteInputValue(e.currentTarget.value)}
              style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
            />
          </div>
          <div className="bp6-dialog-footer">
            <div className="bp6-dialog-footer-actions">
              <Button onClick={() => setPasteDialogOpen(false)}>Cancel</Button>
              <Button
                intent="primary"
                loading={pasteLoading}
                onClick={handlePasteLoad}
                disabled={!pasteInputValue.trim()}
              >
                Load
              </Button>
            </div>
          </div>
        </Dialog>
      </Navbar>

      {/* Main content: map-dominant layout */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
        {/* Mobile toggle: List | Map */}
        <div className="block md:hidden" style={{ padding: 8, borderBottom: '1px solid rgba(17,20,24,0.15)' }}>
          <ButtonGroup fill>
            <Button
              active={mobileShowSidebar}
              onClick={() => setMobileShowSidebar(true)}
            >
              List
            </Button>
            <Button
              active={!mobileShowSidebar}
              onClick={() => setMobileShowSidebar(false)}
            >
              Map
            </Button>
          </ButtonGroup>
        </div>

        {/* Full-screen map */}
        <div className="flex-1 relative overflow-hidden w-full">
          <PlacesMap
            selectedPlaceId={selectedPlaceId}
              onSelectPlace={handleSelectPlace}
              addMode={sidebarView === 'add'}
            pendingCoords={pendingCoords}
            onPickLocation={(lng, lat) => setPendingCoords([lng, lat])}
            drawMode={drawMode}
            drawVertices={drawVertices}
            onAddVertex={(lng, lat) => setDrawVertices((v) => [...v, [lng, lat]])}
            urlLoadingInput={urlLoadingInput}
            onUrlLoadingInputChange={setUrlLoadingInput}
            onLoadFromUrl={handleLoadFromUrl}
            isLoadingFromUrl={loadingFromUrl}
          />
          <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 1000 }}>
            <PlaceLegend />
          </div>

          {/* Draw-area controls */}
          {drawMode && (
            <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1001, background: '#fff', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="bp6-text-small bp6-text-muted">คลิกบนแผนที่เพื่อวาดพื้นที่ ({drawVertices.length} จุด)</span>
              <Button intent="primary" small icon="search" loading={areaLoading} disabled={drawVertices.length < 3} onClick={searchArea}>
                ค้นหาในพื้นที่นี้
              </Button>
              <Button small icon="floppy-disk" disabled={drawVertices.length < 3} onClick={() => setSavePolyOpen(true)}>
                บันทึกเป็นสถานที่
              </Button>
              <Button small icon="cross" onClick={clearArea}>ล้าง</Button>
            </div>
          )}

          {/* Area search results */}
          {areaResults && !drawMode && (
            <div style={{ position: 'absolute', top: 16, right: 16, width: 240, maxHeight: 'calc(100% - 32px)', zIndex: 1001, background: '#fff', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid rgba(17,20,24,0.1)' }}>
                <strong className="bp6-text-small">ในพื้นที่: {areaResults.length} จุด</strong>
                <Button icon="cross" minimal small onClick={() => setAreaResults(null)} />
              </div>
              <div style={{ overflowY: 'auto', padding: 4 }}>
                {areaResults.length === 0 ? (
                  <div className="bp6-text-muted bp6-text-small" style={{ padding: 8 }}>ไม่พบสถานที่ในพื้นที่นี้</div>
                ) : (
                  areaResults.map((f) => (
                    <div key={f.id} onClick={() => handleSelectPlace(f.id)} style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 13 }} className="bp6-text-small">
                      {f.properties.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Save drawn polygon as a place */}
          <Dialog isOpen={savePolyOpen} onClose={() => setSavePolyOpen(false)} title="บันทึกพื้นที่เป็นสถานที่ (Polygon)">
            <div className="bp6-dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InputGroup placeholder="ชื่อสถานที่ (จำเป็น)" value={polyName} onValueChange={setPolyName} autoFocus />
              <HTMLSelect value={polyType} onChange={(e) => setPolyType(e.currentTarget.value as PlaceType)} fill>
                {Object.entries(PLACE_TYPE_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </HTMLSelect>
              <span className="bp6-text-muted bp6-text-small">พื้นที่ที่วาด: {drawVertices.length} จุด</span>
            </div>
            <div className="bp6-dialog-footer">
              <div className="bp6-dialog-footer-actions">
                <Button onClick={() => setSavePolyOpen(false)}>ยกเลิก</Button>
                <Button intent="primary" loading={createMutation.isPending} disabled={!polyName.trim()} onClick={saveDrawnPolygon}>
                  บันทึก
                </Button>
              </div>
            </div>
          </Dialog>

          {/* Bottom drawer: PlacesTable */}
          {tableOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 300,
                background: '#fff',
                borderTop: '1px solid rgba(17,20,24,0.15)',
                boxShadow: '0 -4px 12px rgba(0,0,0,0.1)',
                zIndex: 1001,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 12px', borderBottom: '1px solid rgba(17,20,24,0.1)' }}>
                <span className="bp6-text-muted bp6-text-small">Places Table</span>
                <Button icon="cross" minimal small onClick={() => setTableOpen(false)} />
              </div>
              <div className="flex-1 overflow-hidden">
                <PlacesTable selectedPlaceId={selectedPlaceId} onSelectPlace={handleSelectPlace} />
              </div>
            </div>
          )}
        </div>

        {/* Floating "show panel" button — the collapse toggle lives inside the
            panel, which slides off-screen when collapsed, so surface a way back. */}
        {sidebarCollapsed && (
          <div className="hidden md:block" style={{ position: 'absolute', left: 16, top: 76, zIndex: 1000 }}>
            <Button
              icon="chevron-right"
              onClick={() => setSidebarCollapsed(false)}
              title="Show panel"
              style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
            />
          </div>
        )}

        {/* Floating sidebar panel (desktop only, overlay) */}
        <div
          className="hidden md:flex"
          style={{
            position: 'absolute',
            left: sidebarCollapsed ? -300 : 16,
            top: 76,
            width: 300,
            maxHeight: 'calc(100vh - 76px - 32px)',
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 999,
            transition: 'left 0.3s ease-out',
          }}
        >
          {/* Collapse/expand toggle */}
          <div style={{ padding: 8, borderBottom: '1px solid rgba(17,20,24,0.1)', display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              icon={sidebarCollapsed ? 'chevron-right' : 'chevron-left'}
              minimal
              small
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Show panel' : 'Hide panel'}
            />
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-hidden">
            <Sidebar
              view={sidebarView}
              selectedPlaceId={selectedPlaceId}
              pendingCoords={pendingCoords}
              onViewChange={setSidebarView}
              onSelectPlace={setSelectedPlaceId}
              onPendingCoordsChange={setPendingCoords}
            />
          </div>
        </div>

        {/* Mobile full-width sidebar (shown when toggled) */}
        <div
          className={`md:hidden flex-1 overflow-hidden ${
            mobileShowSidebar ? 'block' : 'hidden'
          }`}
        >
          <Sidebar
            view={sidebarView}
            selectedPlaceId={selectedPlaceId}
            pendingCoords={pendingCoords}
            onViewChange={setSidebarView}
            onSelectPlace={setSelectedPlaceId}
            onPendingCoordsChange={setPendingCoords}
          />
        </div>
      </div>
    </div>
  );
}
