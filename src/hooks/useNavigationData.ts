import { useEffect } from 'react';

import { strings } from '@/i18n';
import {
  fairwayNetworkService,
  navigationMarkersService,
  normalizeApiError,
} from '@/services';
import {
  NAVIGATION_CACHE_TTL_MS,
  useNavigationStore,
  type NavigationDataset,
} from '@/stores/navigationStore';
import type { MapRegion } from '@/types';

const QUERY_DEBOUNCE_MS = 650;

function regionKey(region: MapRegion, dataset: NavigationDataset): string {
  const round = (value: number) => Math.round(value * 4) / 4;
  return `${dataset}:${round(region.latitude - region.latitudeDelta / 2)}:${round(
    region.longitude - region.longitudeDelta / 2,
  )}:${round(region.latitude + region.latitudeDelta / 2)}:${round(
    region.longitude + region.longitudeDelta / 2,
  )}`;
}

export function useNavigationData(
  region: MapRegion,
  dataset: NavigationDataset,
  enabled: boolean,
  networkAvailable: boolean,
) {
  const loading = useNavigationStore((state) => state.loading[dataset]);
  const error = useNavigationStore((state) => state.errors[dataset]);

  useEffect(() => {
    if (!enabled) return;
    const key = regionKey(region, dataset);
    const cached = useNavigationStore.getState().cacheEntries[key];
    const isFresh =
      cached &&
      cached.featureCount > 0 &&
      Date.now() - Date.parse(cached.fetchedAt) < NAVIGATION_CACHE_TTL_MS;
    if (isFresh || !networkAvailable) return;

    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      const store = useNavigationStore.getState();
      store.setLoading(dataset, true);
      store.setError(dataset, null);
      const request =
        dataset === 'fairways'
          ? fairwayNetworkService
              .getSegments({ region, signal: controller.signal })
              .then((values) => {
                if (active) store.setFairways(key, values);
              })
          : navigationMarkersService
              .getMarkers({ region, signal: controller.signal })
              .then((values) => {
                if (active) store.setMarkers(key, values);
              });
      request
        .catch((requestError: unknown) => {
          const apiError = normalizeApiError(requestError, {
            operation: `load${dataset}`,
            provider: 'rijkswaterstaat',
          });
          if (active && apiError.kind !== 'canceled') {
            store.setError(
              dataset,
              dataset === 'fairways'
                ? strings.fairwaysUnavailable
                : strings.markersUnavailable,
            );
          }
        })
        .finally(() => {
          if (active) store.setLoading(dataset, false);
        });
    }, QUERY_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      active = false;
      controller.abort();
      useNavigationStore.getState().setLoading(dataset, false);
    };
  }, [dataset, enabled, networkAvailable, region]);

  return { loading, error };
}
