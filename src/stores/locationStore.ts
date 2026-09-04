import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  isTracking: boolean;
  error: string | null;
  setLocation: (location: LocationData) => void;
  setMapRegion: (region: MapRegion) => void;
  setMapZoom: (zoom: number) => void;
  setPermissionStatus: (status: LocationPermissionStatus) => void;
  setTracking: (isTracking: boolean) => void;
  setError: (error: string | null) => void;
  clearLocation: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      location: null,
      mapRegion: null,
      mapZoom: null,
      permissionStatus: 'undetermined',
      isTracking: false,
      error: null,
      setLocation: (location) => set({ location, error: null }),
      setMapRegion: (mapRegion) => set({ mapRegion }),
      setMapZoom: (mapZoom) => set({ mapZoom }),
      setPermissionStatus: (permissionStatus) => set({ permissionStatus }),
      setTracking: (isTracking) => set({ isTracking }),
      setError: (error) => set({ error, isTracking: false }),
      clearLocation: () => set({ location: null, error: null }),
    }),
    {
      name: 'sail-location',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ location, mapRegion, mapZoom, permissionStatus }) => ({
        location,
        mapRegion,
        mapZoom,
        permissionStatus,
      }),
    },
  ),
);
