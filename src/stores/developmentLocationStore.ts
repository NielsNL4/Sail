import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deduplicateStorage } from './deduplicateStorage';

import type { Coordinates, LocationData } from '@/types';

import { destinationCoordinates } from '../utils/navigationCalculations';

export interface DevelopmentLocationConfiguration {
  coordinates: Coordinates;
  courseDegrees: number;
  speedKnots: number;
  accuracyMeters: number;
}

interface DevelopmentLocationState extends DevelopmentLocationConfiguration {
  enabled: boolean;
  running: boolean;
  lastAdvancedAtMs: number | null;
  setEnabled: (enabled: boolean) => void;
  setConfiguration: (configuration: DevelopmentLocationConfiguration) => void;
  start: (nowMs?: number) => void;
  pause: () => void;
  reset: () => void;
  advance: (nowMs?: number) => void;
}

export const DEFAULT_DEVELOPMENT_LOCATION: DevelopmentLocationConfiguration = {
  coordinates: { latitude: 52.75, longitude: 5.35 },
  courseDegrees: 315,
  speedKnots: 5,
  accuracyMeters: 5,
};

export const useDevelopmentLocationStore = create<DevelopmentLocationState>()(
  persist(
    (set) => ({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: false,
      running: false,
      lastAdvancedAtMs: null,
      setEnabled: (enabled) =>
        set({ enabled, running: false, lastAdvancedAtMs: null }),
      setConfiguration: (configuration) =>
        set({ ...configuration, running: false, lastAdvancedAtMs: null }),
      start: (nowMs = Date.now()) =>
        set((state) =>
          state.enabled
            ? { running: true, lastAdvancedAtMs: nowMs }
            : { running: false, lastAdvancedAtMs: null },
        ),
      pause: () => set({ running: false, lastAdvancedAtMs: null }),
      reset: () =>
        set((state) => ({
          ...DEFAULT_DEVELOPMENT_LOCATION,
          enabled: state.enabled,
          running: false,
          lastAdvancedAtMs: null,
        })),
      advance: (nowMs = Date.now()) =>
        set((state) => {
          if (!state.enabled || !state.running) return state;

          const previousMs = state.lastAdvancedAtMs ?? nowMs;
          const elapsedSeconds = Math.max(
            0,
            Math.min(5, (nowMs - previousMs) / 1_000),
          );
          return {
            coordinates: destinationCoordinates(
              state.coordinates,
              state.courseDegrees,
              state.speedKnots * (elapsedSeconds / 3_600),
            ),
            lastAdvancedAtMs: nowMs,
          };
        }),
    }),
    {
      name: 'sail-development-location',
      storage: deduplicateStorage(createJSONStorage(() => AsyncStorage)),
      partialize: ({
        enabled,
        coordinates,
        courseDegrees,
        speedKnots,
        accuracyMeters,
      }) => ({
        enabled,
        coordinates,
        courseDegrees,
        speedKnots,
        accuracyMeters,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...((persisted ?? {}) as Partial<DevelopmentLocationState>),
        running: false,
        lastAdvancedAtMs: null,
      }),
    },
  ),
);

export function developmentLocationFromState(
  state: DevelopmentLocationConfiguration,
  timestampMs = Date.now(),
): LocationData {
  return {
    coordinates: state.coordinates,
    accuracyMeters: state.accuracyMeters,
    altitudeMeters: null,
    headingDegrees: state.courseDegrees,
    speedMetersPerSecond: state.speedKnots / 1.9438444924,
    timestamp: new Date(timestampMs).toISOString(),
    isMocked: true,
    source: 'development',
  };
}
