import { test, expect, type Page, type Locator } from '@playwright/test';

// Frontend E2E — full UI workflow driven against a stateful in-memory API mock,
// so create/edit/delete actually persist across refetches without a real backend.

type Geometry = { type: string; coordinates: any };
type Feat = {
  type: 'Feature';
  id: string;
  geometry: Geometry;
  properties: { name: string; type: string; description: string | null; createdAt: string };
};

function feat(id: string, name: string, type: string, coords: [number, number]): Feat {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: coords },
    properties: { name, type, description: null, createdAt: '2026-07-11T00:00:00.000Z' },
  };
}

// Install a stateful mock for /places on the page. Returns nothing; state lives in closure.
async function mockApi(page: Page, initial: Feat[]) {
  const store = [...initial];
  let nextId = 1000;

  await page.route(/\/places(\/|\?|$)/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const idMatch = url.pathname.match(/\/places\/([^/]+)$/);
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // /places/nearby → treat as a list query
    if (idMatch && idMatch[1] === 'nearby') {
      return json(200, { type: 'FeatureCollection', features: store });
    }

    if (method === 'GET' && !idMatch) {
      const q = url.searchParams.get('q')?.toLowerCase();
      const type = url.searchParams.get('type');
      let feats = store;
      if (type) feats = feats.filter((f) => f.properties.type === type);
      if (q) feats = feats.filter((f) => f.properties.name.toLowerCase().includes(q));
      return json(200, { type: 'FeatureCollection', features: feats });
    }
    if (method === 'GET' && idMatch) {
      const f = store.find((x) => x.id === idMatch[1]);
      return f ? json(200, f) : json(404, { statusCode: 404, message: 'not found', error: 'Not Found' });
    }
    if (method === 'POST' && url.pathname.endsWith('/within')) {
      // Mock returns everything; real ST_Within filtering is covered in api.spec.ts.
      return json(200, { type: 'FeatureCollection', features: store });
    }
    if (method === 'POST') {
      const dto = req.postDataJSON();
      const f = feat(String(nextId++), dto.name, dto.type, dto.geometry.coordinates);
      f.properties.description = dto.description ?? null;
      store.push(f);
      return json(201, f);
    }
    if (method === 'PATCH' && idMatch) {
      const f = store.find((x) => x.id === idMatch[1]);
      if (!f) return json(404, {});
      const dto = req.postDataJSON();
      if (dto.name != null) f.properties.name = dto.name;
      if (dto.type != null) f.properties.type = dto.type;
      if (dto.description !== undefined) f.properties.description = dto.description;
      return json(200, f);
    }
    if (method === 'DELETE' && idMatch) {
      const i = store.findIndex((x) => x.id === idMatch[1]);
      if (i >= 0) store.splice(i, 1);
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
}

// The app mounts a desktop + mobile sidebar; pick the visible (desktop) element.
const vis = (loc: Locator) => loc.filter({ visible: true }).first();

const CAFE = feat('a', 'After You Cafe', 'cafe', [100.53, 13.74]);
const HOSP = feat('b', 'Bumrungrad Hospital', 'hospital', [100.55, 13.74]);

test.describe('web app — full workflow', () => {
  test('lists places and filters by type', async ({ page }) => {
    await mockApi(page, [CAFE, HOSP]);
    await page.goto('/');

    await expect(vis(page.getByText('After You Cafe'))).toBeVisible();
    await expect(vis(page.getByText('Bumrungrad Hospital'))).toBeVisible();

    // Filter by type = Cafe (HTMLSelect that has the "All Types" option)
    const typeSelect = vis(
      page.locator('select').filter({ has: page.locator('option', { hasText: 'All Types' }) }),
    );
    await typeSelect.selectOption({ label: 'Cafe' });

    await expect(vis(page.getByText('After You Cafe'))).toBeVisible();
    // Only the desktop sidebar was filtered (each sidebar keeps its own filter
    // state), so assert no *visible* Hospital item remains.
    await expect(page.getByText('Bumrungrad Hospital').filter({ visible: true })).toHaveCount(0);
  });

  test('searches places by name', async ({ page }) => {
    await mockApi(page, [CAFE, HOSP]);
    await page.goto('/');

    await vis(page.getByPlaceholder('Search by name...')).fill('Bumrungrad');

    await expect(vis(page.getByText('Bumrungrad Hospital'))).toBeVisible();
    await expect(page.getByText('After You Cafe').filter({ visible: true })).toHaveCount(0);
  });

  test('opens detail view for a place', async ({ page }) => {
    await mockApi(page, [CAFE, HOSP]);
    await page.goto('/');

    await vis(page.getByText('After You Cafe')).click();

    await expect(vis(page.getByRole('heading', { name: 'After You Cafe' }))).toBeVisible();
    await expect(vis(page.getByRole('button', { name: 'Edit' }))).toBeVisible();
    await expect(vis(page.getByRole('button', { name: 'Delete' }))).toBeVisible();
  });

  test('edits a place name', async ({ page }) => {
    await mockApi(page, [CAFE, HOSP]);
    await page.goto('/');

    await vis(page.getByText('After You Cafe')).click();
    await vis(page.getByRole('button', { name: 'Edit' })).click();

    const nameInput = vis(page.getByPlaceholder('Name'));
    await nameInput.fill('After You Cafe (renamed)');
    await vis(page.getByRole('button', { name: 'Save' })).click();

    await expect(vis(page.getByText('After You Cafe (renamed)'))).toBeVisible();
  });

  test('deletes a place', async ({ page }) => {
    await mockApi(page, [CAFE, HOSP]);
    await page.goto('/');

    await vis(page.getByText('Bumrungrad Hospital')).click();
    await vis(page.getByRole('button', { name: 'Delete' })).click();

    // Blueprint Alert confirmation
    await page.locator('.bp6-alert').getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText('Bumrungrad Hospital')).toHaveCount(0);
    await expect(vis(page.getByText('After You Cafe'))).toBeVisible();
  });

  test('adds a place by picking a location on the map', async ({ page }) => {
    await mockApi(page, [CAFE]);
    await page.goto('/');

    await vis(page.getByRole('button', { name: 'Add Place' })).click();

    // In add mode a click on the map sets the location.
    await expect(vis(page.getByText('Click on the map to set the location'))).toBeVisible();
    await page.mouse.click(900, 400);

    await vis(page.getByPlaceholder('Place name (required)')).fill('New PW Place');
    await vis(page.getByRole('button', { name: 'Save' })).click();

    await expect(vis(page.getByText('New PW Place'))).toBeVisible();
  });

  test('draws an area and finds places inside it', async ({ page }) => {
    await mockApi(page, [CAFE, HOSP]);
    await page.goto('/');

    // Enter draw mode, drop 3 vertices on the map, then search the area.
    await vis(page.getByRole('button', { name: 'Area' })).click();
    const box = await page.locator('canvas.maplibregl-canvas').first().boundingBox();
    if (!box) throw new Error('no map canvas');
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);

    await page.getByRole('button', { name: 'ค้นหาในพื้นที่นี้' }).click();

    await expect(page.getByText(/ในพื้นที่: \d+ จุด/)).toBeVisible();
    await expect(vis(page.getByText('After You Cafe'))).toBeVisible();
  });

  test('draws a polygon and saves it as a place', async ({ page }) => {
    await mockApi(page, [CAFE]);
    await page.goto('/');

    await vis(page.getByRole('button', { name: 'Area' })).click();
    const box = await page.locator('canvas.maplibregl-canvas').first().boundingBox();
    if (!box) throw new Error('no map canvas');
    await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.4);
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.4);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);

    await page.getByRole('button', { name: 'บันทึกเป็นสถานที่' }).click();
    await page.getByPlaceholder('ชื่อสถานที่ (จำเป็น)').fill('พื้นที่ทดสอบ');
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();

    await expect(vis(page.getByText('พื้นที่ทดสอบ'))).toBeVisible();
  });

  test('clicking a marker shows its detail even when the panel is collapsed', async ({ page }) => {
    await mockApi(page, [CAFE]);
    await page.goto('/');

    // Collapse the panel, then click the map marker.
    await page.locator('[title="Hide panel"]').first().click();
    await expect(vis(page.locator('[title="Show panel"]'))).toBeVisible();
    await page.locator('.maplibregl-marker').first().click();

    // Detail must surface (panel auto-expands) with the place name + actions.
    await expect(vis(page.getByRole('heading', { name: 'After You Cafe' }))).toBeVisible();
    await expect(vis(page.getByRole('button', { name: 'Edit' }))).toBeVisible();
  });
});
