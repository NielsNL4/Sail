import { describe, expect, it } from 'vitest';

import {
  directionToCompass,
  formatTemperature,
  formatWindSpeed,
} from './weather';

describe('weather formatting', () => {
  it('formats wind speed using the selected unit', () => {
    expect(formatWindSpeed(10, 'knots')).toBe('19 kn');
    expect(formatWindSpeed(10, 'beaufort')).toBe('5 Bft');
    expect(formatWindSpeed(10, 'metersPerSecond')).toBe('10.0 m/s');
  });

  it('uses Dutch compass abbreviations', () => {
    expect(directionToCompass(0)).toBe('N');
    expect(directionToCompass(90)).toBe('O');
    expect(directionToCompass(263)).toBe('W');
    expect(directionToCompass(-45)).toBe('NW');
  });

  it('formats temperature and preserves unavailable values', () => {
    expect(formatTemperature(20, 'celsius')).toBe('20 °C');
    expect(formatTemperature(20, 'fahrenheit')).toBe('68 °F');
    expect(formatTemperature(null, 'celsius')).toBeNull();
  });
});
