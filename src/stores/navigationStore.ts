import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { FairwaySegment, NavigationMarker } from '@/types';

export type NavigationDataset = 'fairways' | 'markers';

interface NavigationCacheEntry {
  key: string;
  dataset: NavigationDataset;
  fetchedAt: string;
  featureCount: number;
}

interface NavigationState {
  fairways: Record<string, FairwaySegment>;
  markers: Record<string, NavigationMarker>;
  cacheEntries: Record<string, NavigationCacheEntry>;
  loading: Record<NavigationDataset, boolean>;
  errors: Record<NavigationDataset, string | null>;
  setLoading: (dataset: NavigationDataset, value: boolean) => void;
  setError: (dataset: NavigationDataset, error: string | null) => void;
  setFairways: (key: string, values: FairwaySegment[]) => void;
  setMarkers: (key: string, values: NavigationMarker[]) => void;
  clear: () => void;
}

const initialState = {
  fairways: {},
  markers: {},
  cacheEntries: {},
  loading: { fairways: false, markers: false },
  errors: { fairways: null, markers: null },
};

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      ...initialState,
      setLoading: (dataset, value) =>
        set((state) => ({ loading: { ...state.loading, [dataset]: value } })),
      setError: (dataset, error) =>
        set((state) => ({ errors: { ...state.errors, [dataset]: error } })),
      setFairways: (key, values) =>
        set((state) => ({
          fairways: {
            ...state.fairways,
            ...Object.fromEntries(values.map((value) => [value.id, value])),
          },
          cacheEntries: {
            ...state.cacheEntries,
            [key]: {
              key,
              dataset: 'fairways',
              fetchedAt: new Date().toISOString(),
              featureCount: values.length,
            },
          },
        })),
      setMarkers: (key, values) =>
        set((state) => ({
          markers: {
            ...state.markers,
            ...Object.fromEntries(values.map((value) => [value.id, value])),
          },
          cacheEntries: {
            ...state.cacheEntries,
            [key]: {
              key,
              dataset: 'markers',
              fetchedAt: new Date().toISOString(),
              featureCount: values.length,
            },
          },
        })),
      clear: () => set(initialState),
    }),
    {
      name: 'sail-navigation',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ fairways, markers, cacheEntries }) => ({
        fairways,
        markers,
        cacheEntries,
      }),
      version: 1,
      migrate: (persisted) => ({
        ...(persisted as object),
        // Previous builds could persist empty successful responses for seven days.
        cacheEntries: {},
      }),
    },
  ),
);

export const NAVIGATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
