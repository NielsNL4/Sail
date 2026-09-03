import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MapStyleId, WindColorMode } from '@/types';

export type WindSpeedUnit = 'knots' | 'beaufort' | 'metersPerSecond';
export type DistanceUnit = 'nauticalMiles' | 'kilometers';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

interface SettingsState {
  windSpeedUnit: WindSpeedUnit;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  mapStyle: MapStyleId;
  windColorMode: WindColorMode;
  setWindSpeedUnit: (unit: WindSpeedUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setMapStyle: (mapStyle: MapStyleId) => void;
  setWindColorMode: (windColorMode: WindColorMode) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  windSpeedUnit: 'knots' as const,
  distanceUnit: 'nauticalMiles' as const,
  temperatureUnit: 'celsius' as const,
  mapStyle: 'modern' as const,
  windColorMode: 'speed' as const,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setWindSpeedUnit: (windSpeedUnit) => set({ windSpeedUnit }),
      setDistanceUnit: (distanceUnit) => set({ distanceUnit }),
      setTemperatureUnit: (temperatureUnit) => set({ temperatureUnit }),
      setMapStyle: (mapStyle) => set({ mapStyle }),
      setWindColorMode: (windColorMode) => set({ windColorMode }),
      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'sail-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({
        windSpeedUnit,
        distanceUnit,
        temperatureUnit,
        mapStyle,
        windColorMode,
      }) => ({
        windSpeedUnit,
        distanceUnit,
        temperatureUnit,
        mapStyle,
        windColorMode,
      }),
    },
  ),
);
