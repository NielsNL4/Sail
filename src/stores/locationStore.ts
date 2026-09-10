import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deduplicateStorage } from './deduplicateStorage';

import type {
  LocationData,
  LocationPermissionStatus,
  MapRegion,
} from '@/types';

interface LocationState {
  location: LocationData | null;
  mapRegion: MapRegion | null;
  mapZoom: number | null;
  permissionStatus: LocationPermissionStatus;
  isLocating: boolean;
  error: string | null;
  setLocation: (location: LocationData) => void;
  setMapRegion: (region: MapRegion) => void;
  setMapZoom: (zoom: number) => void;
  setMapViewport: (region: MapRegion, zoom: number) => void;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setLocating: (isLocating: boolean) => void;
  setError: (error: string | null) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      location: null,
      mapRegion: null,
      mapZoom: null,
      permissionStatus: 'undetermined',
      isLocating: false,
      error: null,
      setLocation: (location) => set({ location, error: null }),
      setMapRegion: (mapRegion) => set({ mapRegion }),
      setMapZoom: (mapZoom) => set({ mapZoom }),
      setMapViewport: (mapRegion, mapZoom) => {
        const previous = get();
        // Guard before set so unchanged viewports skip persistence entirely.
        if (
          previous.mapRegion !== null &&
          previous.mapZoom !== null &&
          Math.abs(previous.mapRegion.latitude - mapRegion.latitude) <= 1e-7 &&
          Math.abs(previous.mapRegion.longitude - mapRegion.longitude) <=
            1e-7 &&
          Math.abs(
            previous.mapRegion.latitudeDelta - mapRegion.latitudeDelta,
          ) <= 1e-7 &&
          Math.abs(
            previous.mapRegion.longitudeDelta - mapRegion.longitudeDelta,
          ) <= 1e-7 &&
          Math.abs(previous.mapZoom - mapZoom) <= 1e-6
        ) {
          return;
        }
        set({ mapRegion, mapZoom });
      },
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setLocating: (isLocating) => set({ isLocating }),
      setError: (error) => set({ error, isLocating: false }),
      clearLocation: () => set({ location: null, error: null }),
    }),
    {
      name: 'sail-location',
      storage: deduplicateStorage(createJSONStorage(() => AsyncStorage)),
      partialize: ({ mapRegion, mapZoom }) => ({
        mapRegion,
        mapZoom,
      }),
      version: 1,
      migrate: (persisted) => {
        const saved = (persisted ?? {}) as Partial<LocationState>;
        return {
          mapRegion: saved.mapRegion ?? null,
          mapZoom: saved.mapZoom ?? null,
        };
      },
    },
  ),
);
