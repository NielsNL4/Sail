import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayersStore } from './layersStore';

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

describe('layersStore', () => {
  beforeEach(async () => {
    storedValues.clear();
    useLayersStore.getState().resetLayers();
    await useLayersStore.persist.clearStorage();
  });

  it('defaults to wind and weather warnings enabled', () => {
    expect(useLayersStore.getState().visibility).toEqual({
      wind: true,
      depth: false,
      vessels: false,
      fairway: false,
      buoys: false,
      bridgesLocks: false,
      tides: false,
      waypoints: false,
      weatherWarnings: true,
    });
  });

  it('toggles and persists a layer visibility setting', async () => {
    useLayersStore.getState().toggleLayer('depth');
    await vi.waitFor(() => expect(storedValues.has('sail-layers')).toBe(true));
    const persistedValue = storedValues.get('sail-layers');

    useLayersStore.getState().resetLayers();
    if (persistedValue) {
      storedValues.set('sail-layers', persistedValue);
    }
    await useLayersStore.persist.rehydrate();

    expect(useLayersStore.getState().visibility.depth).toBe(true);
  });

  it('sets a layer explicitly without changing other layers', () => {
    useLayersStore.getState().setLayerVisibility('wind', false);

    expect(useLayersStore.getState().visibility).toMatchObject({
      wind: false,
      depth: false,
      weatherWarnings: true,
    });
  });

  it('adds new layer defaults when rehydrating older settings', async () => {
    storedValues.set(
      'sail-layers',
      JSON.stringify({
        state: {
          visibility: {
            wind: false,
            depth: true,
            tides: false,
            waypoints: false,
            weatherWarnings: true,
          },
        },
        version: 0,
      }),
    );

    await useLayersStore.persist.rehydrate();

    expect(useLayersStore.getState().visibility).toMatchObject({
      wind: false,
      depth: true,
      vessels: false,
    });
  });
});
