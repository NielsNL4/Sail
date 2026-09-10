import AsyncStorage from '@react-native-async-storage/async-storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DEVELOPMENT_LOCATION,
  developmentLocationFromState,
  useDevelopmentLocationStore,
} from './developmentLocationStore';
import { useLocationStore } from './locationStore';
import { useNavigationStore } from './navigationStore';
import { useWeatherStore } from './weatherStore';

const storedValues = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storedValues.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storedValues.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storedValues.delete(key);
    }),
  },
}));

describe('persisted store writes', () => {
  beforeEach(async () => {
    await Promise.all([
      useLocationStore.persist.rehydrate(),
      useNavigationStore.persist.rehydrate(),
      useWeatherStore.persist.rehydrate(),
      useDevelopmentLocationStore.persist.rehydrate(),
    ]);
    useLocationStore.setState({ mapRegion: null, mapZoom: null });
    useNavigationStore.getState().clear();
    useWeatherStore.getState().clearWeather();
    useDevelopmentLocationStore.setState({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: false,
      running: false,
      lastAdvancedAtMs: null,
    });
    vi.clearAllMocks();
  });

  afterEach(() => vi.restoreAllMocks());

  it('skips serialization and writes for live fixes, permission, loading and errors', () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    const store = useLocationStore.getState();

    for (let timestamp = 0; timestamp < 10; timestamp++) {
      store.setLocating(true);
      store.setError('GPS unavailable');
      store.setLocation(
        developmentLocationFromState(DEFAULT_DEVELOPMENT_LOCATION, timestamp),
      );
    }
    store.setPermissionStatus('granted');
    store.clearLocation();

    expect(stringify).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    const region = {
      latitude: 52.75,
      longitude: 5.35,
      latitudeDelta: 0.5,
      longitudeDelta: 0.75,
    };
    store.setMapRegion(region);
    store.setMapZoom(13);
    store.setMapRegion(region);
    store.setMapZoom(13);

    expect(stringify).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storedValues.get('sail-location')!)).toEqual({
      state: { mapRegion: region, mapZoom: 13 },
      version: 1,
    });
  });

  it('saves navigation datasets and clearing, but not loading or errors', () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    const store = useNavigationStore.getState();
    store.setLoading('fairways', true);
    store.setError('markers', 'Unavailable');
    store.setLoading('fairways', false);
    expect(stringify).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    store.setFairways('fairway-area', []);
    store.setMarkers('marker-area', []);
    expect(stringify).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storedValues.get('sail-navigation')!).state).toEqual({
      fairways: {},
      markers: {},
      cacheEntries: useNavigationStore.getState().cacheEntries,
    });
    store.clear();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(3);
    expect(
      JSON.parse(storedValues.get('sail-navigation')!).state.cacheEntries,
    ).toEqual({});
  });

  it('saves weather updates and clearing, but not request state', () => {
    const stringify = vi.spyOn(JSON, 'stringify');
    const store = useWeatherStore.getState();
    store.setLoading(true);
    store.setRequestCoordinates({ latitude: 52, longitude: 5 });
    store.setError('Unavailable');
    expect(stringify).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    const weather = {
      current: {
        coordinates: { latitude: 52, longitude: 5 },
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
      provider: 'open-meteo' as const,
      fetchedAt: '2026-09-04T10:31:00.000Z',
      isCached: false,
    };
    store.setWeather(weather);
    store.setLoading(true);
    store.setError('Unavailable');
    expect(stringify).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storedValues.get('sail-weather')!)).toEqual({
      state: { weather },
      version: 0,
    });
    store.clearWeather();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });

  it('skips simulation runtime state but still saves advancing coordinates', () => {
    const store = useDevelopmentLocationStore.getState();
    store.setEnabled(true);
    vi.clearAllMocks();
    const stringify = vi.spyOn(JSON, 'stringify');
    store.start(0);
    store.pause();
    store.advance(1_000);
    store.start(1_000);
    expect(stringify).not.toHaveBeenCalled();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();

    store.advance(2_000);
    expect(stringify).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storedValues.get('sail-development-location')!)).toEqual({
      state: {
        ...DEFAULT_DEVELOPMENT_LOCATION,
        enabled: true,
        coordinates: useDevelopmentLocationStore.getState().coordinates,
      },
      version: 0,
    });
  });

  it('allows the same durable state to be saved after clearStorage', async () => {
    await useLocationStore.persist.clearStorage();
    expect(storedValues.has('sail-location')).toBe(false);
    useLocationStore.getState().setLocating(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(storedValues.has('sail-location')).toBe(true);
  });

  it('preserves location migration and its write back during async hydration', async () => {
    storedValues.set(
      'sail-location',
      JSON.stringify({
        state: {
          mapZoom: 9,
          location: { obsolete: true },
          permissionStatus: 'granted',
        },
        version: 0,
      }),
    );
    await useLocationStore.persist.rehydrate();
    expect(useLocationStore.getState().mapZoom).toBe(9);
    expect(JSON.parse(storedValues.get('sail-location')!)).toEqual({
      state: { mapRegion: null, mapZoom: 9 },
      version: 1,
    });
    vi.clearAllMocks();
    useLocationStore.getState().setLocating(false);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});
