import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { deduplicateStorage } from './deduplicateStorage';

import type { Coordinates, WeatherData } from '@/types';

interface WeatherState {
  weather: WeatherData | null;
  requestCoordinates: Coordinates | null;
  isLoading: boolean;
  error: string | null;
  setWeather: (weather: WeatherData) => void;
  setRequestCoordinates: (coordinates: Coordinates) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearWeather: () => void;
}

interface PersistedWeatherState {
  weather: WeatherData | null;
}

const initialWeatherState = {
  weather: null,
  requestCoordinates: null,
  isLoading: false,
  error: null,
};

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      ...initialWeatherState,
      setWeather: (weather) => set({ weather, error: null, isLoading: false }),
      setRequestCoordinates: (requestCoordinates) =>
        set({ requestCoordinates }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      clearWeather: () => set(initialWeatherState),
    }),
    {
      name: 'sail-weather',
      storage: deduplicateStorage(createJSONStorage(() => AsyncStorage)),
      partialize: ({ weather }) => ({ weather }),
      merge: (persistedState, currentState) => {
        const persistedWeather = (
          persistedState as PersistedWeatherState | undefined
        )?.weather;
        const currentWeather = currentState.weather;
        const persistedTime = persistedWeather
          ? new Date(persistedWeather.fetchedAt).getTime()
          : Number.NEGATIVE_INFINITY;
        const currentTime = currentWeather
          ? new Date(currentWeather.fetchedAt).getTime()
          : Number.NEGATIVE_INFINITY;

        return {
          ...currentState,
          weather:
            currentWeather && currentTime >= persistedTime
              ? currentWeather
              : persistedWeather
                ? { ...persistedWeather, isCached: true }
                : null,
        };
      },
    },
  ),
);
