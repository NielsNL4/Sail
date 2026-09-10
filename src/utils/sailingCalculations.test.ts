import { describe, expect, it } from 'vitest';

import type { NavigationMetrics } from '@/types';

import {
  calculateSailingGuidance,
  createSailingOverlay,
} from './sailingCalculations';
import { destinationCoordinates } from './navigationCalculations';

const navigation: NavigationMetrics = {
  sogKnots: 5,
  cogDegrees: 315,
  bearingToWaypointDegrees: 0,
  distanceToWaypointNm: 4,
  vmgToWaypointKnots: 3.5,
  eta: null,
  crossTrackErrorNm: 0,
  projectedCoordinates: null,
  gpsQuality: 'good',
};

function guidance(
  overrides: Partial<NavigationMetrics> = {},
  windFromDegrees = 0,
) {
  return calculateSailingGuidance({
    navigation: { ...navigation, ...overrides },
    profile: { closeHauledAngleDegrees: 45 },
    wind: {
      directionDegrees: windFromDegrees,
      speedMetersPerSecond: 5,
      gustMetersPerSecond: 7,
    },
    windFetchedAt: '2026-09-07T12:00:00.000Z',
    windValidAt: '2026-09-07T12:00:00.000Z',
    nowMs: Date.parse('2026-09-07T12:05:00.000Z'),
  });
}

describe('calculateSailingGuidance', () => {
  it('calculates headings and current tack around north', () => {
    const result = guidance();

    expect(result.destinationInNoGoZone).toBe(true);
    expect(result.portTackHeadingDegrees).toBe(45);
    expect(result.starboardTackHeadingDegrees).toBe(315);
    expect(result.currentTack).toBe('starboard');
    expect(result.relativeWindAngleToCourseDegrees).toBe(45);
    expect(result.vmgToWindKnots).toBeCloseTo(3.536, 2);
  });

  it('recommends the tack with more progress toward the waypoint', () => {
    const result = guidance({ bearingToWaypointDegrees: 285 }, 270);

    expect(result.portTackHeadingDegrees).toBe(315);
    expect(result.starboardTackHeadingDegrees).toBe(225);
    expect(result.recommendedTack).toBe('port');
    expect(result.recommendedHeadingDegrees).toBe(315);
  });

  it('does not choose arbitrarily between equivalent tacks', () => {
    const result = guidance();

    expect(result.recommendedTack).toBeNull();
    expect(result.recommendedHeadingDegrees).toBeNull();
  });

  it('does not assign a tack on an exactly downwind course', () => {
    const result = guidance({ cogDegrees: 180 });

    expect(result.currentTack).toBeNull();
  });

  it('suppresses headings for stale forecast data', () => {
    const result = calculateSailingGuidance({
      navigation,
      profile: { closeHauledAngleDegrees: 45 },
      wind: {
        directionDegrees: 0,
        speedMetersPerSecond: 5,
        gustMetersPerSecond: null,
      },
      windFetchedAt: '2026-09-07T12:00:00.000Z',
      windValidAt: '2026-09-07T12:00:00.000Z',
      nowMs: Date.parse('2026-09-07T12:16:00.000Z'),
    });

    expect(result.quality).toBe('stale');
    expect(result.portTackHeadingDegrees).toBeNull();
    expect(result.recommendedHeadingDegrees).toBeNull();
  });

  it('suppresses guidance for a future-dated forecast fetch', () => {
    const result = calculateSailingGuidance({
      navigation,
      profile: { closeHauledAngleDegrees: 45 },
      wind: {
        directionDegrees: 0,
        speedMetersPerSecond: 5,
        gustMetersPerSecond: null,
      },
      windFetchedAt: '2026-09-07T12:30:00.000Z',
      windValidAt: '2026-09-07T12:00:00.000Z',
      nowMs: Date.parse('2026-09-07T12:00:00.000Z'),
    });

    expect(result.quality).toBe('stale');
  });
});

describe('createSailingOverlay', () => {
  it('creates laylines and a closed no-go sector', () => {
    const result = createSailingOverlay(
      { latitude: 52.7, longitude: 5.3 },
      { latitude: 52.8, longitude: 5.3 },
      guidance(),
    );

    expect(result?.portLayline).toHaveLength(2);
    expect(result?.starboardLayline).toHaveLength(2);
    expect(result?.noGoZone[0]).toEqual(result?.noGoZone.at(-1));
  });

  it('calculates a finite tack point for the recommended initial tack', () => {
    const current = { latitude: 52.7, longitude: 5.3 };
    const target = destinationCoordinates(current, 285, 4);
    const result = createSailingOverlay(
      current,
      target,
      guidance({ bearingToWaypointDegrees: 285 }, 270),
    );

    expect(result?.recommendedTackPoint).not.toBeNull();
    expect(Number.isFinite(result?.recommendedTackPoint?.latitude ?? NaN)).toBe(
      true,
    );
  });
});
