import { describe, expect, it } from 'vitest';

import {
  fairwayColor,
  fairwaysToGeoJson,
  markersToGeoJson,
  navigationMarkerColorKey,
} from './navigationLayer';

describe('navigationLayer', () => {
  it('converts fairways and markers to map GeoJSON', () => {
    const fairway = {
      id: 'f1',
      geometry: { type: 'MultiLineString' as const, coordinates: [] },
      cemtClass: 'IV' as const,
      name: null,
      description: null,
      code: 'IV',
      fetchedAt: '2026-09-04T12:00:00.000Z',
    };
    const marker = {
      id: 'm1',
      type: 'buoy' as const,
      position: { latitude: 52, longitude: 5 },
      name: null,
      number: null,
      description: null,
      waterway: null,
      category: null,
      shape: null,
      color: null,
      colorPattern: null,
      light: null,
      fetchedAt: '2026-09-04T12:00:00.000Z',
    };

    expect(fairwaysToGeoJson([fairway]).features[0].properties).toEqual({
      id: 'f1',
      cemtClass: 'IV',
    });
    expect(markersToGeoJson([marker]).features[0].geometry.coordinates).toEqual(
      [5, 52],
    );
    expect(
      markersToGeoJson([{ ...marker, color: 'Groen' }]).features[0].properties,
    ).toMatchObject({ color: 'green' });
    expect(navigationMarkerColorKey('onbekend')).toBe('unknown');
    expect(fairwayColor('IV')).not.toBe(fairwayColor('unknown'));
  });
});
