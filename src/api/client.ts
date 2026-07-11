/**
 * API Client — Mini Spatial Data Platform
 *
 * Thin fetch wrapper for all CONTRACT endpoints.
 * Points at VITE_API_URL environment variable.
 */

import type {
  CreatePlaceDto,
  Feature,
  FeatureCollection,
  PlaceType,
} from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = new URL(path, API_URL).toString();
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      typeof error.message === 'string'
        ? error.message
        : `HTTP ${res.status} ${res.statusText}`
    );
  }

  // 204 No Content on DELETE
  if (res.status === 204) {
    return undefined as any;
  }

  return res.json();
}

export const placesApi = {
  /**
   * GET /places
   * Optional filters: bbox, type, q (name search)
   */
  listPlaces: async (params?: {
    bbox?: string; // "minLng,minLat,maxLng,maxLat"
    type?: PlaceType;
    q?: string;
  }): Promise<FeatureCollection> => {
    const query = new URLSearchParams();
    if (params?.bbox) query.append('bbox', params.bbox);
    if (params?.type) query.append('type', params.type);
    if (params?.q) query.append('q', params.q);

    const path = query.size > 0 ? `/places?${query.toString()}` : '/places';
    return request('GET', path);
  },

  /**
   * GET /places/:id
   */
  getPlace: async (id: string): Promise<Feature> => {
    return request('GET', `/places/${id}`);
  },

  /**
   * GET /places/nearby
   * Required: lng, lat, radius (meters)
   */
  nearbyPlaces: async (params: {
    lng: number;
    lat: number;
    radius: number;
  }): Promise<FeatureCollection> => {
    const query = new URLSearchParams({
      lng: String(params.lng),
      lat: String(params.lat),
      radius: String(params.radius),
    });
    return request('GET', `/places/nearby?${query.toString()}`);
  },

  /**
   * POST /places
   * Returns: Feature (201)
   */
  createPlace: async (dto: CreatePlaceDto): Promise<Feature> => {
    return request('POST', '/places', dto);
  },

  /**
   * PATCH /places/:id
   * Partial update (name, type, geometry)
   */
  updatePlace: async (id: string, dto: Partial<CreatePlaceDto>): Promise<Feature> => {
    return request('PATCH', `/places/${id}`, dto);
  },

  /**
   * DELETE /places/:id
   * Returns: 204 No Content
   */
  deletePlace: async (id: string): Promise<void> => {
    return request('DELETE', `/places/${id}`);
  },
};
