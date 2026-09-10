import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocationData } from '../types';
import { distanceInNauticalMiles, initialBearingDegrees } from './coordinates';
import {
  calculateOwnMotion,
  isOwnLocationVisible,
  ownVesselToGeoJson,
} from './ownMotion';

const location: LocationData = {
  coordinates: { latitude: 52.75, longitude: 5.35 },
  accuracyMeters: 5,
  altitudeMeters: null,
  headingDegrees: 90,
  speedMetersPerSecond: 2,
  timestamp: '2026-09-07T12:00:00.000Z',
  isMocked: false,
  source: 'device',
};
const now = Date.parse(location.timestamp);
afterEach(() => vi.unstubAllGlobals());

describe('own motion', () => {
  it('returns session-independent SOG and COG, including north and zero speed', () => {
    expect(calculateOwnMotion(location, now)).toEqual({
      sogKnots: 3.8876889848,
      cogDegrees: 90,
      gpsQuality: 'good',
    });
    expect(
      calculateOwnMotion({ ...location, headingDegrees: 360 }, now).cogDegrees,
    ).toBe(0);
    expect(
      calculateOwnMotion({ ...location, speedMetersPerSecond: 0 }, now),
    ).toEqual({ sogKnots: 0, cogDegrees: null, gpsQuality: 'good' });
  });
  it.each([null, -1, NaN, Infinity, -Infinity, Number.MAX_VALUE])(
    'rejects invalid speed %s',
    (speedMetersPerSecond) => {
      expect(
        calculateOwnMotion({ ...location, speedMetersPerSecond }, now).sogKnots,
      ).toBeNull();
      expect(
        ownVesselToGeoJson({ ...location, speedMetersPerSecond }, now).features,
      ).toHaveLength(1);
    },
  );
  it.each([null, -1, NaN, Infinity, 361])(
    'rejects invalid course %s',
    (headingDegrees) => {
      expect(
        calculateOwnMotion({ ...location, headingDegrees }, now).cogDegrees,
      ).toBeNull();
    },
  );
  it('gates COG at 0.5 knots without hiding valid SOG', () => {
    const slow = { ...location, speedMetersPerSecond: 0.49 / 1.9438444924 };
    expect(calculateOwnMotion(slow, now).sogKnots).toBeCloseTo(0.49);
    expect(calculateOwnMotion(slow, now).cogDegrees).toBeNull();
    expect(
      calculateOwnMotion(
        { ...slow, speedMetersPerSecond: 0.5 / 1.9438444924 },
        now,
      ).cogDegrees,
    ).toBe(90);
  });
  it('expires without new fixes and recovers on a fresh fix', () => {
    expect(calculateOwnMotion(location, now + 10_000).gpsQuality).toBe('good');
    expect(calculateOwnMotion(location, now + 10_001)).toEqual({
      sogKnots: null,
      cogDegrees: null,
      gpsQuality: 'stale',
    });
    const stale = ownVesselToGeoJson(location, now + 11_000);
    expect(stale.features).toHaveLength(1);
    expect(stale.features[0].properties).toMatchObject({
      directional: false,
      color: '#f59e0b',
    });
    expect(
      ownVesselToGeoJson(
        { ...location, timestamp: new Date(now + 11_000).toISOString() },
        now + 11_000,
      ).features,
    ).toHaveLength(2);
    expect(calculateOwnMotion(location, now - 5_001).gpsQuality).toBe('stale');
    expect(calculateOwnMotion(location, NaN).gpsQuality).toBe('stale');
    expect(
      calculateOwnMotion({ ...location, timestamp: 'invalid' }, now).gpsQuality,
    ).toBe('stale');
  });
  it.each([null, -1, NaN, Infinity, 51])(
    'flags poor accuracy %s',
    (accuracyMeters) => {
      expect(
        calculateOwnMotion({ ...location, accuracyMeters }, now),
      ).toMatchObject({ gpsQuality: 'poor', cogDegrees: 90 });
    },
  );
  it.each([
    { latitude: NaN, longitude: 0 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: Infinity },
    { latitude: 0, longitude: -181 },
  ])('hides invalid coordinates %s', (coordinates) => {
    const invalid = { ...location, coordinates };
    expect(isOwnLocationVisible(invalid)).toBe(false);
    expect(calculateOwnMotion(invalid, now).gpsQuality).toBe('unavailable');
    expect(ownVesselToGeoJson(invalid, now).features).toEqual([]);
  });
  it('clears missing fixes', () => {
    expect(calculateOwnMotion(null, now)).toEqual({
      sogKnots: null,
      cogDegrees: null,
      gpsQuality: 'unavailable',
    });
    expect(ownVesselToGeoJson(null, now).features).toEqual([]);
  });
  it('allows amber development motion only in dev builds, never trusts device mocks', () => {
    const development = {
      ...location,
      source: 'development' as const,
      isMocked: true,
    };
    vi.stubGlobal('__DEV__', false);
    expect(calculateOwnMotion(development, now).gpsQuality).toBe('unavailable');
    expect(ownVesselToGeoJson(development, now).features).toEqual([]);
    vi.stubGlobal('__DEV__', true);
    expect(calculateOwnMotion(development, now).cogDegrees).toBe(90);
    expect(
      ownVesselToGeoJson(development, now).features[0].properties.color,
    ).toBe('#f59e0b');
    expect(calculateOwnMotion({ ...location, isMocked: true }, now)).toEqual({
      sogKnots: null,
      cogDegrees: null,
      gpsQuality: 'mocked',
    });
  });
  it.each([0, 90, 180, 270])(
    'projects 30 seconds geodesically at %s degrees across the dateline',
    (headingDegrees) => {
      const fix = {
        ...location,
        headingDegrees,
        coordinates: { latitude: 70, longitude: 179.9999 },
      };
      const shape = ownVesselToGeoJson(fix, now);
      const vector = shape.features[1].geometry;
      expect(vector.type).toBe('LineString');
      if (vector.type !== 'LineString') throw new Error('Missing vector');
      const [start, end] = vector.coordinates;
      expect(Math.abs(end[0] - start[0])).toBeLessThan(1);
      const destination = { latitude: end[1], longitude: end[0] };
      expect(
        distanceInNauticalMiles(fix.coordinates, destination) * 1852,
      ).toBeCloseTo(60, 2);
      expect(initialBearingDegrees(fix.coordinates, destination)).toBeCloseTo(
        headingDegrees,
        5,
      );
      expect(shape.features[0].properties).toMatchObject({
        directional: true,
        rotation: headingDegrees,
        color: '#0284c7',
      });
    },
  );
});
