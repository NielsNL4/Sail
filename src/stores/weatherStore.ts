import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { WeatherData } from '@/types';

interface WeatherState {
  weather: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  setWeather: (weather: WeatherData) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearWeather: () => void;
}

interface PersistedWeatherState {
  weather: WeatherData | null;
}

const initialWeatherState = {
  weather: null,
  isLoading: false,
  error: null,
};

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set) => ({
      ...initialWeatherState,
      setWeather: (weather) => set({ weather, error: null, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      clearWeather: () => set(initialWeatherState),
    }),
    {
      name: 'sail-weather',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ weather }) => ({ weather }),
      merge: (persistedState, currentState) => {
        const persistedWeather = (
          persistedState as PersistedWeatherState | undefined
        )?.weather;

        return {
          ...currentState,
          weather: persistedWeather
            ? { ...persistedWeather, isCached: true }
            : null,
        };
      },
    },
  ),
);
