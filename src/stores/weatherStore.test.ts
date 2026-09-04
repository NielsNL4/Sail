import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WeatherData } from '../types';

import { useWeatherStore } from './weatherStore';

const storedValues = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storedValues.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      storedValues.set(key, value);
    },
    removeItem: async (key: string) => {
      storedValues.delete(key);
    },
  },
}));

const weather = {
  current: {
    coordinates: { latitude: 52.65, longitude: 5.25 },
    temperatureCelsius: 18,
    wind: {
      speedMetersPerSecond: 6,
      gustMetersPerSecond: 8,
      directionDegrees: 240,
    },
    conditionCode: '2',
    observedAt: '2026-09-04T10:30:00.000Z',
  },
  forecast: [],
  provider: 'open-meteo',
  fetchedAt: '2026-09-04T10:31:00.000Z',
  isCached: false,
} satisfies WeatherData;

describe('weatherStore offline fallback', () => {
  beforeEach(async () => {
    storedValues.clear();
    useWeatherStore.getState().clearWeather();
    await useWeatherStore.persist.clearStorage();
  });

  it('rehydrates stored weather as cached data', async () => {
    useWeatherStore.getState().setWeather(weather);
    await vi.waitFor(() => expect(storedValues.has('sail-weather')).toBe(true));
    const persistedValue = storedValues.get('sail-weather');

    useWeatherStore.getState().clearWeather();
    if (persistedValue) {
      storedValues.set('sail-weather', persistedValue);
    }
    await useWeatherStore.persist.rehydrate();

    expect(useWeatherStore.getState().weather).toEqual({
      ...weather,
      isCached: true,
    });
  });

  it('retains weather when a refresh fails', () => {
    useWeatherStore.getState().setWeather(weather);
    useWeatherStore.getState().setError('Tijdelijk niet beschikbaar.');

    expect(useWeatherStore.getState()).toMatchObject({
      weather,
      error: 'Tijdelijk niet beschikbaar.',
      isLoading: false,
    });
  });

  it('does not replace newer weather when hydration finishes late', async () => {
    const olderWeather = {
      ...weather,
      fetchedAt: '2026-09-04T09:31:00.000Z',
    };
    useWeatherStore.setState({ weather });
    await vi.waitFor(() => expect(storedValues.has('sail-weather')).toBe(true));
    storedValues.set(
      'sail-weather',
      JSON.stringify({ state: { weather: olderWeather }, version: 0 }),
    );

    await useWeatherStore.persist.rehydrate();

    expect(useWeatherStore.getState().weather).toEqual(weather);
  });
});
