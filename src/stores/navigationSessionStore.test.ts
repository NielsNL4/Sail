import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_TRACK_POINTS } from '../utils/navigationCalculations';

import { useNavigationSessionStore } from './navigationSessionStore';

describe('navigationSessionStore', () => {
  beforeEach(() => useNavigationSessionStore.getState().stop());

  it('starts and activates a navigation session', () => {
    const target = {
      id: 'target',
      name: 'Bestemming',
      coordinates: { latitude: 52.8, longitude: 5.4 },
    };

    useNavigationSessionStore.getState().begin(target);
    expect(useNavigationSessionStore.getState().status).toBe('acquiring');

    useNavigationSessionStore
      .getState()
      .activate({ latitude: 52.75, longitude: 5.35 });

    expect(useNavigationSessionStore.getState().status).toBe('navigating');
    expect(
      useNavigationSessionStore.getState().session?.startCoordinates,
    ).toEqual({ latitude: 52.75, longitude: 5.35 });
  });

  it('caps the recorded track length', () => {
    useNavigationSessionStore.getState().begin({
      id: 'target',
      name: 'Bestemming',
      coordinates: { latitude: 52.8, longitude: 5.4 },
    });

    for (let index = 0; index <= MAX_TRACK_POINTS; index += 1) {
      useNavigationSessionStore.getState().appendTrackPoint({
        latitude: 52 + index / 10_000,
        longitude: 5,
        accuracyMeters: 5,
        timestamp: new Date(index * 1_000).toISOString(),
      });
    }

    const track = useNavigationSessionStore.getState().session?.track ?? [];
    expect(track).toHaveLength(MAX_TRACK_POINTS);
    expect(track[0]?.latitude).toBeGreaterThan(52);
  });
});
