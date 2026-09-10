import { describe, expect, it } from 'vitest';

import { sailingOverlayToGeoJson } from './sailingGuidanceLayer';

describe('sailingOverlayToGeoJson', () => {
  it('returns no features without current guidance', () => {
    expect(sailingOverlayToGeoJson(null).features).toEqual([]);
  });

  it('creates no-go and layline features', () => {
    const result = sailingOverlayToGeoJson({
      noGoZone: [
        { latitude: 52.7, longitude: 5.3 },
        { latitude: 52.71, longitude: 5.29 },
        { latitude: 52.7, longitude: 5.3 },
      ],
      portLayline: [
        { latitude: 52.75, longitude: 5.25 },
        { latitude: 52.8, longitude: 5.3 },
      ],
      starboardLayline: [
        { latitude: 52.75, longitude: 5.35 },
        { latitude: 52.8, longitude: 5.3 },
      ],
      recommendedTackPoint: { latitude: 52.74, longitude: 5.28 },
    });

    expect(result.features.map((feature) => feature.properties.kind)).toEqual([
      'no-go',
      'port',
      'starboard',
      'tack-point',
    ]);
  });
});
