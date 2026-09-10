import { beforeEach, describe, expect, it, vi } from 'vitest';

import { distanceInNauticalMiles } from '../utils/coordinates';
import {
  DEFAULT_DEVELOPMENT_LOCATION,
  developmentLocationFromState,
  useDevelopmentLocationStore,
} from './developmentLocationStore';

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

describe('developmentLocationStore', () => {
  beforeEach(async () => {
    storedValues.clear();
    await useDevelopmentLocationStore.persist.clearStorage();
    useDevelopmentLocationStore.setState({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: false,
      running: false,
      lastAdvancedAtMs: null,
    });
  });

  it('advances a running six-knot boat by about 0.1 NM per minute', () => {
    const store = useDevelopmentLocationStore.getState();
    store.setEnabled(true);
    store.setConfiguration({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      speedKnots: 6,
    });
    useDevelopmentLocationStore.getState().start(0);
    const start = useDevelopmentLocationStore.getState().coordinates;

    for (let second = 5; second <= 60; second += 5) {
      useDevelopmentLocationStore.getState().advance(second * 1_000);
    }

    const end = useDevelopmentLocationStore.getState().coordinates;
    expect(distanceInNauticalMiles(start, end)).toBeCloseTo(0.1, 3);
  });

  it('does not advance while paused or disabled', () => {
    const start = useDevelopmentLocationStore.getState().coordinates;
    useDevelopmentLocationStore.getState().advance(5_000);
    useDevelopmentLocationStore.getState().setEnabled(true);
    useDevelopmentLocationStore.getState().advance(10_000);

    expect(useDevelopmentLocationStore.getState().coordinates).toEqual(start);
  });

  it('caps a delayed update to five seconds of movement', () => {
    useDevelopmentLocationStore.getState().setEnabled(true);
    useDevelopmentLocationStore.getState().start(0);
    const start = useDevelopmentLocationStore.getState().coordinates;
    useDevelopmentLocationStore.getState().advance(60_000);

    expect(
      distanceInNauticalMiles(
        start,
        useDevelopmentLocationStore.getState().coordinates,
      ),
    ).toBeCloseTo((5 * 5) / 3_600, 4);
  });

  it('creates a complete mocked development fix', () => {
    const fix = developmentLocationFromState(
      DEFAULT_DEVELOPMENT_LOCATION,
      1_700_000_000_000,
    );

    expect(fix).toMatchObject({
      isMocked: true,
      source: 'development',
      headingDegrees: 315,
      accuracyMeters: 5,
    });
  });

  it('always rehydrates in a paused state', async () => {
    storedValues.set(
      'sail-development-location',
      JSON.stringify({
        state: {
          ...DEFAULT_DEVELOPMENT_LOCATION,
          enabled: true,
          running: true,
          lastAdvancedAtMs: 123,
        },
        version: 0,
      }),
    );

    await useDevelopmentLocationStore.persist.rehydrate();

    expect(useDevelopmentLocationStore.getState()).toMatchObject({
      enabled: true,
      running: false,
      lastAdvancedAtMs: null,
    });
  });
});
