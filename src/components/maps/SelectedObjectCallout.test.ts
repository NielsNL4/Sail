import { describe, expect, it } from 'vitest';

import { getCalloutPosition } from './calloutPosition';

describe('getCalloutPosition', () => {
  it('keeps a callout inside a narrow phone screen', () => {
    const position = getCalloutPosition({ x: 4, y: 100 }, 390, 844, 47, 34);

    expect(position.left).toBe(12);
    expect(position.top).toBeGreaterThanOrEqual(59);
    expect(position.width).toBe(320);
    expect(position.above).toBe(false);
  });

  it('places the callout above a low map feature', () => {
    const position = getCalloutPosition({ x: 500, y: 700 }, 1024, 768, 0, 0);

    expect(position.above).toBe(true);
    expect(position.top).toBe(493);
    expect(position.left).toBe(340);
  });
});
