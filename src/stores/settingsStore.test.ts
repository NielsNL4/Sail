import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSettingsStore } from './settingsStore';

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

describe('settingsStore map style persistence', () => {
  beforeEach(async () => {
    storedValues.clear();
    useSettingsStore.getState().resetSettings();
    await useSettingsStore.persist.clearStorage();
  });

  it('defaults to the modern nautical style', () => {
    expect(useSettingsStore.getState().mapStyle).toBe('modern');
    expect(useSettingsStore.getState().windColorMode).toBe('speed');
  });

  it('round-trips the selected map style through storage', async () => {
    useSettingsStore.getState().setMapStyle('dark');
    await vi.waitFor(() =>
      expect(storedValues.has('sail-settings')).toBe(true),
    );
    const persistedValue = storedValues.get('sail-settings');

    useSettingsStore.getState().setMapStyle('modern');
    if (persistedValue) {
      storedValues.set('sail-settings', persistedValue);
    }
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().mapStyle).toBe('dark');
  });

  it('persists the high-contrast wind color mode', async () => {
    useSettingsStore.getState().setWindColorMode('contrast');
    await vi.waitFor(() =>
      expect(storedValues.has('sail-settings')).toBe(true),
    );
    const persistedValue = storedValues.get('sail-settings');

    useSettingsStore.getState().setWindColorMode('speed');
    if (persistedValue) {
      storedValues.set('sail-settings', persistedValue);
    }
    await useSettingsStore.persist.rehydrate();

    expect(useSettingsStore.getState().windColorMode).toBe('contrast');
  });
});
