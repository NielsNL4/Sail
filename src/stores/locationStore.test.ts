import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocationStore } from './locationStore';

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

describe('locationStore map region persistence', () => {
  beforeEach(async () => {
    storedValues.clear();
    useLocationStore.setState({ mapRegion: null });
    await useLocationStore.persist.clearStorage();
  });

  it('round-trips the last map region through storage', async () => {
    const region = {
      latitude: 52.75,
      longitude: 5.35,
      latitudeDelta: 0.5,
      longitudeDelta: 0.75,
    };

    useLocationStore.getState().setMapRegion(region);
    await vi.waitFor(() =>
      expect(storedValues.has('sail-location')).toBe(true),
    );
    const persistedValue = storedValues.get('sail-location');

    useLocationStore.setState({ mapRegion: null });
    if (persistedValue) {
      storedValues.set('sail-location', persistedValue);
    }
    await useLocationStore.persist.rehydrate();

    expect(useLocationStore.getState().mapRegion).toEqual(region);
  });
});
