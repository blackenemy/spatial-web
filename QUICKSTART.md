# Frontend — Mini Spatial Data Platform

Vite + React + TypeScript + MapLibre GL JS + React Query

## Structure

```
web/src/
├── types/api.ts              # GeoJSON & DTO types (from CONTRACT.md)
├── api/client.ts             # fetch wrapper for all endpoints
├── hooks/
│   ├── usePlaces.ts          # React Query hooks for data fetching/mutations
│   └── useDebounce.ts        # debounce utility
├── components/
│   └── PlaceTypeIcon.tsx      # place type legend & icons
├── features/
│   ├── places-table/
│   │   ├── PlacesTable.tsx    # filterable table with sync to map
│   │   └── EditPlaceForm.tsx  # inline edit form
│   ├── places-map/
│   │   └── PlacesMap.tsx      # MapLibre map with click-to-add
├── utils/
│   └── coordinates.test.ts    # minimal test: [lng,lat] <-> form mapping
├── App.tsx                    # main layout (table + map split view)
└── main.tsx                   # React Query provider setup
```

## Features

- **Split view**: table (left 1/3) + map (right 2/3), synced selection
- **Add place**: click `+ Add Place` button, click map to pick coordinates, fill name + type
- **Edit place**: click `Edit` in table row, inline form updates via PATCH
- **Delete place**: click `Delete`, confirm, removes via DELETE
- **Search**: debounced name search box
- **Filter**: type dropdown (school, restaurant, attraction, cafe, hospital, other)
- **Markers**: colored by place type, clickable to select (table row highlights)
- **Legend**: shows all place types + icons

## Setup

```bash
cd web

# Install dependencies
npm install

# Development server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Preview production build
npm run preview
```

## Environment

Create `.env.local` (or set env var):

```
VITE_API_URL=http://localhost:3000
```

If API is on a different host/port, update this to point at the backend.

## Docker

Build and run frontend in Docker:

```bash
# From repo root or web/ directory
docker build -f web/Dockerfile -t spatial-web .

# Run on port 3050
docker run -p 3050:3050 spatial-web

# With env var to point at backend
docker run -p 3050:3050 \
  -e VITE_API_URL=http://api:3000 \
  spatial-web
```

Or via `docker-compose` from the repo root (backend + frontend):

```bash
docker compose up
```

## Notes

- Types in `src/types/api.ts` are **handwritten from CONTRACT.md** to avoid circular dependencies during API development. Later, replace with `openapi-typescript api/openapi.json` once the backend exports OpenAPI spec.
- GeoJSON uses **[lng, lat]** order (not [lat, lng]) — enforced in types and PlacesMap click handling.
- All API calls point at `import.meta.env.VITE_API_URL`, making the frontend backend-agnostic.
- Map style from `https://demotiles.maplibre.org/style.json` (free, no API key needed).
- Map center: Bangkok (13.7563, 100.5018).

## Test Coverage

One minimal test in `src/utils/coordinates.test.ts` verifies the non-trivial logic: [lng, lat] ↔ form field mapping works in both directions and survives round-trip conversion. Tests the constraint that form fields (lat, lng in human order) must convert to GeoJSON [lng, lat] order correctly.

## Known Limitations / Stubs

- **No persistence of add/edit state on page reload** — React Query cache is in-memory only. Could add localStorage or service worker later.
- **No conflict detection on concurrent edits** — PATCH always wins. Add optimistic updates + conflict resolution if needed.
- **No undo/redo** — delete is permanent. Soft-delete could implement undo toast.
- **Single-page app, no deep linking** — URL doesn't reflect selected place or filters. Could add query params to sync state.
- **No pagination** — all places loaded at once. Add cursor-based pagination when dataset grows.
- **No clustering** — all markers visible even when zoomed out. MapLibre clustering available if performance needed.
