import { useEffect, useState } from 'react';

import {
  normalizeApiError,
  windFieldGridSizeForZoom,
  windFieldService,
} from '@/services';
import { useWindFieldStore } from '@/stores';
import type { MapRegion, WindField } from '@/types';
import { logApiError } from '@/utils';

const WIND_FIELD_CACHE_DURATION_MS = 15 * 60 * 1_000;

function expandRegion(region: MapRegion, zoom: number): MapRegion {
  const minimumDelta = zoom >= 12 ? 0.04 : 0.2;

  return {
    latitude: region.latitude,
    longitude: region.longitude,
    latitudeDelta: Math.min(
      Math.max(region.latitudeDelta * 1.5, minimumDelta),
      6,
    ),
    longitudeDelta: Math.min(
      Math.max(region.longitudeDelta * 1.5, minimumDelta),
      8,
    ),
  };
}

function fieldCoversRegion(
  field: WindField,
  region: MapRegion,
  gridSize: number,
): boolean {
  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const south = region.latitude - region.latitudeDelta / 2;
  const north = region.latitude + region.latitudeDelta / 2;
  const isFresh =
    Date.now() - new Date(field.fetchedAt).getTime() <
    WIND_FIELD_CACHE_DURATION_MS;

  return (
    isFresh &&
    field.rows >= gridSize &&
    field.columns >= gridSize &&
    west >= field.bounds.west &&
    east <= field.bounds.east &&
    south >= field.bounds.south &&
    north <= field.bounds.north
  );
}

export function useWindField(
  region: MapRegion,
  enabled: boolean,
  zoom: number,
) {
  const [refreshTick, setRefreshTick] = useState(0);
  const field = useWindFieldStore((state) => state.field);
  const isLoading = useWindFieldStore((state) => state.isLoading);
  const error = useWindFieldStore((state) => state.error);
  const startLoading = useWindFieldStore((state) => state.startLoading);
  const setField = useWindFieldStore((state) => state.setField);
  const setError = useWindFieldStore((state) => state.setError);
  const gridSize = windFieldGridSizeForZoom(zoom);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const interval = setInterval(
      () => setRefreshTick((tick) => tick + 1),
      WIND_FIELD_CACHE_DURATION_MS,
    );

    return () => clearInterval(interval);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || (field && fieldCoversRegion(field, region, gridSize))) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    startLoading();

    windFieldService
      .getWindField(expandRegion(region, zoom), controller.signal, gridSize)
      .then((nextField) => {
        if (active) {
          setField(nextField);
        }
      })
      .catch((requestError: unknown) => {
        const apiError = normalizeApiError(requestError, {
          operation: 'loadWindField',
          provider: 'open-meteo',
        });

        if (apiError.kind === 'canceled') {
          return;
        }

        logApiError(apiError);
        if (active) {
          setError(apiError);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    enabled,
    field,
    gridSize,
    refreshTick,
    region,
    setError,
    setField,
    startLoading,
    zoom,
  ]);

  return { field, isLoading, error };
}
