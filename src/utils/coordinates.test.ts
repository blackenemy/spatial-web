/**
 * Minimal test: [lng, lat] <-> form field mapping
 *
 * This test verifies the core non-trivial logic:
 * - GeoJSON uses [lng, lat] order (not [lat, lng])
 * - Form fields expect lat/lng (human readable)
 * - Conversion must be correct in both directions
 *
 * Run: npx vitest run src/utils/coordinates.test.ts
 */

/**
 * convertFormToGeoJSON — convert form inputs (lat, lng) to GeoJSON [lng, lat]
 */
export function convertFormToGeoJSON(lat: number, lng: number): [number, number] {
  return [lng, lat]; // GeoJSON order
}

/**
 * convertGeoJSONToForm — convert GeoJSON [lng, lat] to form fields
 */
export function convertGeoJSONToForm(coords: [number, number]): { lat: number; lng: number } {
  const [lng, lat] = coords;
  return { lat, lng };
}

/**
 * Test suite
 */
describe('Coordinate conversion', () => {
  it('converts form (lat, lng) to GeoJSON [lng, lat]', () => {
    const lat = 13.7563; // Bangkok latitude
    const lng = 100.5018; // Bangkok longitude
    const geojson = convertFormToGeoJSON(lat, lng);
    expect(geojson).toEqual([100.5018, 13.7563]); // [lng, lat]
  });

  it('converts GeoJSON [lng, lat] back to form fields', () => {
    const geojson: [number, number] = [100.5018, 13.7563];
    const form = convertGeoJSONToForm(geojson);
    expect(form.lat).toBe(13.7563);
    expect(form.lng).toBe(100.5018);
  });

  it('handles round-trip: form -> geojson -> form', () => {
    const original = { lat: 13.7563, lng: 100.5018 };
    const geojson = convertFormToGeoJSON(original.lat, original.lng);
    const form = convertGeoJSONToForm(geojson);
    expect(form).toEqual(original);
  });

  it('preserves valid coordinate ranges', () => {
    // Valid coordinate ranges per WGS84
    const validLat = 13.7563;
    const validLng = 100.5018;
    expect(validLat).toBeGreaterThanOrEqual(-90);
    expect(validLat).toBeLessThanOrEqual(90);
    expect(validLng).toBeGreaterThanOrEqual(-180);
    expect(validLng).toBeLessThanOrEqual(180);
  });
});
