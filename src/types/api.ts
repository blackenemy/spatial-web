/**
 * API Types — Mini Spatial Data Platform
 *
 * Handwritten from CONTRACT.md. Later, replace with:
 *   openapi-typescript api/openapi.json --output types/api.ts
 *
 * These types enforce [lng, lat] order per GeoJSON spec and match the backend DTOs exactly.
 */

import type { Geometry } from 'geojson';

export type PlaceType = 'school' | 'restaurant' | 'attraction' | 'cafe' | 'hospital' | 'other';

export interface Point {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// Re-export the full GeoJSON geometry union (Point, LineString, Polygon, Multi*, etc.)
export type { Geometry };

export interface Place {
  id: string; // UUID
  name: string; // 1-120 chars
  type: PlaceType;
  geometry: Geometry; // SRID 4326, any GeoJSON geometry
  createdAt: string; // ISO 8601
}

export interface Feature {
  type: 'Feature';
  id: string; // UUID, same as place.id
  geometry: Geometry; // Point | LineString | Polygon | Multi*
  properties: {
    name: string;
    type: PlaceType;
    description: string | null;
    createdAt: string;
  };
}

export interface FeatureCollection {
  type: 'FeatureCollection';
  features: Feature[];
}

/**
 * CreatePlaceDto — request body for POST /places
 * Validation on backend:
 *   - name: non-empty, ≤120 chars
 *   - type: must be in enum PlaceType
 *   - geometry: valid GeoJSON Point with [lng, lat] coordinates
 */
export interface CreatePlaceDto {
  name: string;
  type: PlaceType;
  description?: string | null;
  geometry: Geometry; // Point | LineString | Polygon | Multi* (SRID 4326, [lng, lat])
}

/**
 * Error response — every error endpoint returns this shape
 */
export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string; // ISO
}
