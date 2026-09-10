import { describe, expect, it } from 'vitest';

import { navigationOverlayToGeoJson } from './navigationGuidanceLayer';

describe('navigationOverlayToGeoJson', () => {
  it('returns an empty collection without active navigation', () => {
    expect(navigationOverlayToGeoJson(null).features).toEqual([]);
  });

  it('creates route, track, projection, arrival, and target features', () => {
    const features = navigationOverlayToGeoJson({
      currentCoordinates: { latitude: 52.75, longitude: 5.35 },
      projectedCoordinates: { latitude: 52.76, longitude: 5.36 },
      routeStartCoordinates: { latitude: 52.74, longitude: 5.34 },
      targetCoordinates: { latitude: 52.8, longitude: 5.4 },
      track: [
        {
          latitude: 52.74,
          longitude: 5.34,
          accuracyMeters: 5,
          timestamp: '2026-09-07T12:00:00.000Z',
        },
        {
          latitude: 52.75,
          longitude: 5.35,
          accuracyMeters: 5,
          timestamp: '2026-09-07T12:01:00.000Z',
        },
      ],
    });

    expect(features.features.map((feature) => feature.properties.kind)).toEqual(
      ['target', 'arrival', 'route', 'track', 'projection'],
    );
  });

  it('keeps a track local when it crosses the antimeridian', () => {
    const collection = navigationOverlayToGeoJson({
      currentCoordinates: null,
      projectedCoordinates: null,
      routeStartCoordinates: null,
      targetCoordinates: { latitude: 0, longitude: 179.999 },
      track: [
        {
          latitude: 0,
          longitude: 179.999,
          accuracyMeters: 5,
          timestamp: '2026-09-07T12:00:00.000Z',
        },
        {
          latitude: 0,
          longitude: -179.999,
          accuracyMeters: 5,
          timestamp: '2026-09-07T12:00:10.000Z',
        },
      ],
    });
    const track = collection.features.find(
      (feature) => feature.properties.kind === 'track',
    );

    expect(track?.geometry.type).toBe('LineString');
    if (track?.geometry.type === 'LineString') {
      expect(track.geometry.coordinates[1]?.[0]).toBeCloseTo(180.001, 3);
    }
  });
});
