import { describe, expect, it } from 'vitest';

import { formatDataTimestamp, isTimestampStale } from './freshness';

describe('data freshness', () => {
  it('marks data stale at the configured age boundary', () => {
    const timestamp = '2026-09-04T10:00:00.000Z';
    const now = new Date('2026-09-04T10:15:00.000Z').getTime();

    expect(isTimestampStale(timestamp, 15 * 60 * 1_000, now - 1)).toBe(false);
    expect(isTimestampStale(timestamp, 15 * 60 * 1_000, now)).toBe(true);
  });

  it('treats invalid timestamps as stale', () => {
    expect(isTimestampStale('invalid', 1_000)).toBe(true);
    expect(formatDataTimestamp('invalid')).toBe('--');
  });

  it('formats a compact numeric timestamp', () => {
    const formatted = formatDataTimestamp('2026-09-04T10:31:00.000Z');

    expect(formatted).toMatch(/^04-09-2026 \d{2}:31$/);
  });
});
