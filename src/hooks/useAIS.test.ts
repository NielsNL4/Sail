import { describe, expect, it } from 'vitest';

import { regionToAISBoundingBox } from '../utils/vessels';

describe('regionToAISBoundingBox', () => {
  it('converts the current viewport region to southwest and northeast bounds', () => {
    expect(
      regionToAISBoundingBox({
        latitude: 52.5,
        longitude: 5,
        latitudeDelta: 2,
        longitudeDelta: 4,
      }),
    ).toEqual({
      southWest: { latitude: 51.5, longitude: 3 },
      northEast: { latitude: 53.5, longitude: 7 },
    });
  });
});
