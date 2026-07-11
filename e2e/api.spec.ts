import { test, expect } from '@playwright/test';

// Backend E2E — full API workflow. Defaults to the deployed API; override with API_URL.
const API = process.env.API_URL || 'https://spatial-api.project-hub.it.com';

test.describe('backend API', () => {
  test('GET /places returns a GeoJSON FeatureCollection', async ({ request }) => {
    const res = await request.get(`${API}/places`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.type).toBe('FeatureCollection');
    expect(Array.isArray(body.features)).toBeTruthy();
  });

  test('OGC /conformance lists conformance classes', async ({ request }) => {
    const res = await request.get(`${API}/conformance`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.conformsTo)).toBeTruthy();
    expect(body.conformsTo.length).toBeGreaterThan(0);
  });

  test('OGC /collections exposes the places collection', async ({ request }) => {
    const res = await request.get(`${API}/collections`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.collections?.[0]?.id).toBe('places');
  });

  test('OGC /collections/places/items returns features', async ({ request }) => {
    const res = await request.get(`${API}/collections/places/items`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.type).toBe('FeatureCollection');
  });

  test('full CRUD lifecycle: create → read → filter → update → delete → 404', async ({
    request,
  }) => {
    const uniqueName = `PW Lifecycle ${Date.now()}`;

    // CREATE
    const create = await request.post(`${API}/places`, {
      data: {
        name: uniqueName,
        type: 'cafe',
        description: 'created by playwright',
        geometry: { type: 'Point', coordinates: [100.5, 13.75] },
      },
    });
    expect(create.status()).toBe(201);
    const feature = await create.json();
    expect(feature.type).toBe('Feature');
    expect(feature.properties.name).toBe(uniqueName);
    const id = feature.id as string;

    // READ single
    const get = await request.get(`${API}/places/${id}`);
    expect(get.status()).toBe(200);

    // SEARCH by name (q) finds it
    const search = await request.get(
      `${API}/places?q=${encodeURIComponent(uniqueName)}`,
    );
    const searchBody = await search.json();
    expect(searchBody.features.some((f: any) => f.id === id)).toBeTruthy();

    // FILTER by type returns only that type
    const byType = await request.get(`${API}/places?type=cafe`);
    const byTypeBody = await byType.json();
    expect(
      byTypeBody.features.every((f: any) => f.properties.type === 'cafe'),
    ).toBeTruthy();

    // UPDATE (PATCH)
    const patch = await request.patch(`${API}/places/${id}`, {
      data: { name: `${uniqueName} (edited)`, type: 'restaurant' },
    });
    expect(patch.status()).toBe(200);
    const patched = await patch.json();
    expect(patched.properties.name).toBe(`${uniqueName} (edited)`);
    expect(patched.properties.type).toBe('restaurant');

    // DELETE
    const del = await request.delete(`${API}/places/${id}`);
    expect(del.status()).toBe(204);

    // GONE
    const gone = await request.get(`${API}/places/${id}`);
    expect(gone.status()).toBe(404);
  });

  test('POST /places/within finds places inside a polygon (PostGIS)', async ({ request }) => {
    // Create a point in Bangkok, then confirm a polygon around Bangkok contains it
    // and a polygon around Chiang Mai does not.
    const create = await request.post(`${API}/places`, {
      data: {
        name: `PW Within ${Date.now()}`,
        type: 'other',
        geometry: { type: 'Point', coordinates: [100.5, 13.75] },
      },
    });
    const id = (await create.json()).id as string;

    const bangkok = await request.post(`${API}/places/within`, {
      data: { polygon: { type: 'Polygon', coordinates: [[[100.3, 13.5], [100.75, 13.5], [100.75, 13.95], [100.3, 13.95], [100.3, 13.5]]] } },
    });
    expect(bangkok.status()).toBe(200);
    const inside = await bangkok.json();
    expect(inside.features.some((f: any) => f.id === id)).toBeTruthy();

    const chiangmai = await request.post(`${API}/places/within`, {
      data: { polygon: { type: 'Polygon', coordinates: [[[98.9, 18.7], [99.0, 18.7], [99.0, 18.8], [98.9, 18.8], [98.9, 18.7]]] } },
    });
    const outside = await chiangmai.json();
    expect(outside.features.some((f: any) => f.id === id)).toBeFalsy();

    await request.delete(`${API}/places/${id}`);
  });

  test('GET /places/nearby returns a FeatureCollection', async ({ request }) => {
    const res = await request.get(
      `${API}/places/nearby?lng=100.5&lat=13.75&radius=100000`,
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.type).toBe('FeatureCollection');
  });

  test('POST /places with invalid body is rejected (400)', async ({
    request,
  }) => {
    const res = await request.post(`${API}/places`, {
      data: { type: 'cafe', geometry: { type: 'Point', coordinates: [100.5, 13.75] } },
    });
    expect(res.status()).toBe(400);
  });
});
