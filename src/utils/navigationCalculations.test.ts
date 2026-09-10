import { describe, expect, it } from 'vitest';

import type { LocationData, NavigationSession } from '@/types';

import {
  calculateNavigationMetrics,
  destinationCoordinates,
  normalizeDegrees,
  smallestAngleDifference,
} from './navigationCalculations';

const location: LocationData = {
  coordinates: { latitude: 52.75, longitude: 5.35 },
  accuracyMeters: 5,
  altitudeMeters: null,
  headingDegrees: 0,
  speedMetersPerSecond: 2,
  timestamp: '2026-09-07T12:00:00.000Z',
  isMocked: false,
  source: 'device',
};

const session: NavigationSession = {
  target: {
    id: 'target',
    name: 'Bestemming',
    coordinates: { latitude: 53.75, longitude: 5.35 },
  },
  startedAt: location.timestamp,
  startCoordinates: location.coordinates,
  track: [],
};

describe('navigation calculations', () => {
  it('normalizes headings and finds the shortest angle across north', () => {
    expect(normalizeDegrees(-10)).toBe(350);
    expect(normalizeDegrees(370)).toBe(10);
    expect(smallestAngleDifference(5, 355)).toBe(10);
    expect(smallestAngleDifference(355, 5)).toBe(-10);
  });

  it('projects a position along a bearing', () => {
    const projected = destinationCoordinates(
      { latitude: 0, longitude: 0 },
      90,
      60.04,
    );

    expect(projected.latitude).toBeCloseTo(0, 4);
    expect(projected.longitude).toBeCloseTo(1, 2);
  });

  it('calculates positive VMG and ETA toward the destination', () => {
    const metrics = calculateNavigationMetrics(
      location,
      session,
      Date.parse(location.timestamp),
    );

    expect(metrics.sogKnots).toBeCloseTo(3.8877, 3);
    expect(metrics.cogDegrees).toBe(0);
    expect(metrics.vmgToWaypointKnots).toBeCloseTo(3.8877, 3);
    expect(metrics.eta).not.toBeNull();
    expect(metrics.gpsQuality).toBe('good');
  });

  it('suppresses movement data from a stale fix', () => {
    const metrics = calculateNavigationMetrics(
      location,
      session,
      Date.parse(location.timestamp) + 11_000,
    );

    expect(metrics.gpsQuality).toBe('stale');
    expect(metrics.sogKnots).toBeNull();
    expect(metrics.eta).toBeNull();
  });

  it('rejects invalid and future-dated GPS timestamps', () => {
    const invalid = calculateNavigationMetrics(
      { ...location, timestamp: 'not-a-date' },
      session,
      Date.parse(location.timestamp),
    );
    const future = calculateNavigationMetrics(
      { ...location, timestamp: '2026-09-07T12:01:00.000Z' },
      session,
      Date.parse(location.timestamp),
    );

    expect(invalid.gpsQuality).toBe('stale');
    expect(future.gpsQuality).toBe('stale');
  });

  it('evaluates app-controlled development fixes normally', () => {
    const metrics = calculateNavigationMetrics(
      { ...location, isMocked: true, source: 'development' },
      session,
      Date.parse(location.timestamp),
    );

    expect(metrics.gpsQuality).toBe('good');
    expect(metrics.sogKnots).not.toBeNull();
  });

  it('does not estimate arrival when sailing away from the destination', () => {
    const metrics = calculateNavigationMetrics(
      { ...location, headingDegrees: 180 },
      session,
      Date.parse(location.timestamp),
    );

    expect(metrics.vmgToWaypointKnots).toBeLessThan(0);
    expect(metrics.eta).toBeNull();
  });
});
