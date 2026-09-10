import { describe, expect, it } from 'vitest';

import { distanceInNauticalMiles, initialBearingDegrees } from './coordinates';

describe('distanceInNauticalMiles', () => {
  it('returns zero for the same position', () => {
    const position = { latitude: 52.75, longitude: 5.35 };

    expect(distanceInNauticalMiles(position, position)).toBe(0);
  });

  it('calculates one degree of latitude as about 60 nautical miles', () => {
    const distance = distanceInNauticalMiles(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );

    expect(distance).toBeCloseTo(60.04, 2);
  });

  it('keeps antipodal distances finite', () => {
    const distance = distanceInNauticalMiles(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 180 },
    );

    expect(Number.isFinite(distance)).toBe(true);
    expect(distance).toBeCloseTo(10_807.28, 1);
  });
});

describe('initialBearingDegrees', () => {
  it('returns north as zero degrees', () => {
    const bearing = initialBearingDegrees(
      { latitude: 0, longitude: 0 },
      { latitude: 1, longitude: 0 },
    );

    expect(bearing).toBeCloseTo(0, 5);
  });

  it('returns east as 90 degrees', () => {
    const bearing = initialBearingDegrees(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    );

    expect(bearing).toBeCloseTo(90, 5);
  });

  it('normalizes westward bearings to a positive heading', () => {
    const bearing = initialBearingDegrees(
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: -1 },
    );

    expect(bearing).toBeCloseTo(270, 5);
  });
});
