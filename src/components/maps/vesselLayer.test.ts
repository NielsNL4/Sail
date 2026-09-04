import { describe, expect, it } from 'vitest';

import type { AISVessel } from '@/types';

import { vesselsToGeoJson } from './vesselLayer';

describe('vesselsToGeoJson', () => {
  it('uses heading, then course, to rotate marker features', () => {
    const vessel: AISVessel = {
      mmsi: '244123456',
      name: null,
      coordinates: { latitude: 52.4, longitude: 4.9 },
      speedKnots: null,
      courseDegrees: 120,
      headingDegrees: null,
      shipType: null,
      dimensions: null,
      lastUpdate: '2026-09-04T12:00:00.000Z',
    };

    expect(vesselsToGeoJson([vessel]).features[0]).toMatchObject({
      id: '244123456',
      geometry: { coordinates: [4.9, 52.4] },
      properties: { mmsi: '244123456', rotation: 120 },
    });
  });
});
