import { describe, expect, it } from 'vitest';

import { isPhoneLayout, PHONE_LAYOUT_MAX_WIDTH } from './responsive';

describe('isPhoneLayout', () => {
  it('uses the compact layout through the phone breakpoint', () => {
    expect(isPhoneLayout(PHONE_LAYOUT_MAX_WIDTH)).toBe(true);
  });

  it('uses the expanded layout above the phone breakpoint', () => {
    expect(isPhoneLayout(PHONE_LAYOUT_MAX_WIDTH + 1)).toBe(false);
  });
});
