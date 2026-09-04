import { describe, expect, it } from 'vitest';

import { feetToMeters, metersToFeet } from './vesselUnits';

describe('vessel units', () => {
  it('converts meters to feet and back', () => {
    expect(metersToFeet(1)).toBeCloseTo(3.28084, 4);
    expect(feetToMeters(metersToFeet(12.5))).toBeCloseTo(12.5, 10);
  });
});
