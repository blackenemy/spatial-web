/**
 * React Query hooks for places data fetching and mutations
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { placesApi } from '../api/client';
import type {
  CreatePlaceDto,
  Feature,
  FeatureCollection,
  PlaceType,
} from '../types/api';

/**
 * useListPlaces — fetch all places with optional filters
 */
export function useListPlaces(params?: {
  bbox?: string; // "minLng,minLat,maxLng,maxLat"
  type?: PlaceType;
  q?: string;
}): UseQueryResult<FeatureCollection> {
  return useQuery({
    queryKey: ['places', params],
    queryFn: () => placesApi.listPlaces(params),
    staleTime: 30000, // 30s
  });
}

/**
 * useGetPlace — fetch a single place by ID
 */
export function useGetPlace(id: string): UseQueryResult<Feature> {
  return useQuery({
    queryKey: ['places', id],
    queryFn: () => placesApi.getPlace(id),
    staleTime: 30000,
  });
}

/**
 * useNearbyPlaces — fetch places within radius
 */
export function useNearbyPlaces(params: {
  lng: number;
  lat: number;
  radius: number;
}): UseQueryResult<FeatureCollection> {
  return useQuery({
    queryKey: ['places-nearby', params],
    queryFn: () => placesApi.nearbyPlaces(params),
    staleTime: 30000,
  });
}

/**
 * useCreatePlace mutation
 */
export function useCreatePlace(): UseMutationResult<Feature, Error, CreatePlaceDto> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreatePlaceDto) => placesApi.createPlace(dto),
    onSuccess: () => {
      // Invalidate places list to refetch
      queryClient.invalidateQueries({ queryKey: ['places'] });
    },
  });
}

/**
 * useUpdatePlace mutation
 */
export function useUpdatePlace(
  id: string
): UseMutationResult<Feature, Error, Partial<CreatePlaceDto>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: Partial<CreatePlaceDto>) =>
      placesApi.updatePlace(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places', id] });
      queryClient.invalidateQueries({ queryKey: ['places'] });
    },
  });
}

/**
 * useDeletePlace mutation
 */
export function useDeletePlace(
  id: string
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => placesApi.deletePlace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['places'] });
      queryClient.removeQueries({ queryKey: ['places', id] });
    },
  });
}
