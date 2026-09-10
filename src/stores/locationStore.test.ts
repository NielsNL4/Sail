import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocationStore } from './locationStore';

const storedValues = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => storedValues.get(key) ?? null,
    setItem: vi.fn(async (key: string, value: string) => {
      storedValues.set(key, value);
    }),
    removeItem: async (key: string) => {
      storedValues.delete(key);
    },
  },
}));

describe('locationStore map region persistence', () => {
  beforeEach(async () => {
    storedValues.clear();
    useLocationStore.setState({
      error: null,
      isLocating: false,
      location: null,
      mapRegion: null,
      mapZoom: null,
      permissionStatus: 'undetermined',
    });
    await useLocationStore.persist.clearStorage();
    vi.mocked(AsyncStorage.setItem).mockClear();
  });

  const viewport = {
    mapRegion: {
      latitude: 52.75,
      longitude: 5.35,
      latitudeDelta: 0.5,
      longitudeDelta: 0.75,
    },
    mapZoom: 13.25,
  };

  it('updates and persists the complete viewport with one notification and write', () => {
    const previous = useLocationStore.getState();
    const listener = vi.fn();
    const unsubscribe = useLocationStore.subscribe(listener);

    try {
      previous.setMapViewport(viewport.mapRegion, viewport.mapZoom);

      expect(listener).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining(viewport),
        previous,
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledExactlyOnceWith(
        'sail-location',
        JSON.stringify({ state: viewport, version: 1 }),
      );
    } finally {
      unsubscribe();
    }
  });

  it.each([0, 0.5])(
    'ignores identical or sub-threshold viewport noise (%s)',
    (scale) => {
      const { setMapViewport } = useLocationStore.getState();
      setMapViewport(viewport.mapRegion, viewport.mapZoom);
      const previous = useLocationStore.getState();
      vi.mocked(AsyncStorage.setItem).mockClear();
      const listener = vi.fn();
      const unsubscribe = useLocationStore.subscribe(listener);

      try {
        for (const direction of [-1, 1]) {
          const noise = direction * scale;
          setMapViewport(
            {
              latitude: viewport.mapRegion.latitude + noise * 1e-7,
              longitude: viewport.mapRegion.longitude + noise * 1e-7,
              latitudeDelta: viewport.mapRegion.latitudeDelta + noise * 1e-7,
              longitudeDelta: viewport.mapRegion.longitudeDelta + noise * 1e-7,
            },
            viewport.mapZoom + noise * 1e-6,
          );
        }

        expect(useLocationStore.getState()).toBe(previous);
        expect(listener).not.toHaveBeenCalled();
        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
      } finally {
        unsubscribe();
      }
    },
  );

  it.each([
    'latitude',
    'longitude',
    'latitudeDelta',
    'longitudeDelta',
    'mapZoom',
  ] as const)('updates when only %s exceeds its threshold', (field) => {
    const { setMapViewport } = useLocationStore.getState();
    setMapViewport(viewport.mapRegion, viewport.mapZoom);
    vi.mocked(AsyncStorage.setItem).mockClear();
    const listener = vi.fn();
    const unsubscribe = useLocationStore.subscribe(listener);
    const mapRegion = { ...viewport.mapRegion };
    const mapZoom = viewport.mapZoom + (field === 'mapZoom' ? 2e-6 : 0);
    if (field !== 'mapZoom') mapRegion[field] += 2e-7;

    try {
      setMapViewport(mapRegion, mapZoom);

      expect(useLocationStore.getState()).toMatchObject({ mapRegion, mapZoom });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });

  it('round-trips the last map region through storage', async () => {
    const region = {
      latitude: 52.75,
      longitude: 5.35,
      latitudeDelta: 0.5,
      longitudeDelta: 0.75,
    };
    const zoom = 13.25;

    useLocationStore.getState().setMapRegion(region);
    useLocationStore.getState().setMapZoom(zoom);
    await vi.waitFor(() =>
      expect(storedValues.has('sail-location')).toBe(true),
    );
    const persistedValue = storedValues.get('sail-location');

    useLocationStore.setState({ mapRegion: null, mapZoom: null });
    if (persistedValue) {
      storedValues.set('sail-location', persistedValue);
    }
    await useLocationStore.persist.rehydrate();

    expect(useLocationStore.getState().mapRegion).toEqual(region);
    expect(useLocationStore.getState().mapZoom).toBe(zoom);
  });

  it('does not persist live position or permission state', async () => {
    useLocationStore.getState().setLocation({
      coordinates: { latitude: 52.75, longitude: 5.35 },
      accuracyMeters: 5,
      altitudeMeters: null,
      headingDegrees: 90,
      speedMetersPerSecond: 2,
      timestamp: new Date().toISOString(),
      isMocked: false,
      source: 'device',
    });
    useLocationStore.getState().setPermissionStatus('granted');

    await vi.waitFor(() =>
      expect(storedValues.has('sail-location')).toBe(true),
    );

    const persisted = storedValues.get('sail-location') ?? '';
    expect(persisted).not.toContain('coordinates');
    expect(persisted).not.toContain('permissionStatus');
  });
});
