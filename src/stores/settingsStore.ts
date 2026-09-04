import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  DepthMode,
  MapStyleId,
  VesselProfile,
  WindColorMode,
} from '@/types';

export type WindSpeedUnit = 'knots' | 'beaufort' | 'metersPerSecond';
export type DistanceUnit = 'nauticalMiles' | 'kilometers';
export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type VesselDimensionUnit = 'meters' | 'feet';
export type VesselDimensionUnits = {
  beam: VesselDimensionUnit;
  length: VesselDimensionUnit;
};

interface SettingsState {
  windSpeedUnit: WindSpeedUnit;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  mapStyle: MapStyleId;
  windColorMode: WindColorMode;
  depthMode: DepthMode;
  vesselProfile: VesselProfile;
  vesselDimensionUnits: VesselDimensionUnits;
  setWindSpeedUnit: (unit: WindSpeedUnit) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setMapStyle: (mapStyle: MapStyleId) => void;
  setWindColorMode: (windColorMode: WindColorMode) => void;
  setDepthMode: (depthMode: DepthMode) => void;
  setVesselProfile: (vesselProfile: VesselProfile) => void;
  setVesselDimensionUnit: (
    dimension: keyof VesselDimensionUnits,
    unit: VesselDimensionUnit,
  ) => void;
  resetSettings: () => void;
}

const defaultSettings = {
  windSpeedUnit: 'knots' as const,
  distanceUnit: 'nauticalMiles' as const,
  temperatureUnit: 'celsius' as const,
  mapStyle: 'modern' as const,
  windColorMode: 'speed' as const,
  depthMode: 'enc' as const,
  vesselProfile: {
    draftMeters: null,
    airDraftMeters: null,
    beamMeters: null,
    lengthMeters: null,
  },
  vesselDimensionUnits: { beam: 'meters', length: 'meters' } as const,
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
      setDepthMode: (depthMode) => set({ depthMode }),
      setVesselProfile: (vesselProfile) => set({ vesselProfile }),
      setVesselDimensionUnit: (dimension, unit) =>
        set((state) => ({
          vesselDimensionUnits: {
            ...state.vesselDimensionUnits,
            [dimension]: unit,
          },
        })),
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
        depthMode,
        vesselProfile,
        vesselDimensionUnits,
      }) => ({
        windSpeedUnit,
        distanceUnit,
        temperatureUnit,
        mapStyle,
        windColorMode,
        depthMode,
        vesselProfile,
        vesselDimensionUnits,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<SettingsState>;
        return {
          ...current,
          ...saved,
          vesselProfile: {
            ...defaultSettings.vesselProfile,
            ...saved.vesselProfile,
          },
          vesselDimensionUnits: {
            ...current.vesselDimensionUnits,
            ...saved.vesselDimensionUnits,
          },
        };
      },
    },
  ),
);
