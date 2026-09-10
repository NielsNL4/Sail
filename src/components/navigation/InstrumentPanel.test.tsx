import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LocationData } from '../../types';
import { InstrumentPanel } from './InstrumentPanel';

const { renderToStaticMarkup } = await vi.importActual<{
  renderToStaticMarkup: (node: ReactNode) => string;
}>('react-dom/server');

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: ({
    children,
    accessibilityLabel,
  }: {
    children: ReactNode;
    accessibilityLabel?: string;
  }) => createElement('div', { 'aria-label': accessibilityLabel }, children),
  Text: ({ children }: { children: ReactNode }) =>
    createElement('span', null, children),
}));

const location: LocationData = {
  coordinates: { latitude: 52.75, longitude: 5.35 },
  accuracyMeters: 5,
  altitudeMeters: null,
  headingDegrees: 90,
  speedMetersPerSecond: 2,
  timestamp: '2026-09-07T12:00:00.000Z',
  isMocked: false,
  source: 'device',
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('InstrumentPanel', () => {
  it('shows comma-decimal knots without a navigation session', () => {
    vi.useFakeTimers().setSystemTime(new Date(location.timestamp));
    const html = renderToStaticMarkup(<InstrumentPanel location={location} />);
    expect(html).toContain('3,9 knopen');
    expect(html).toContain('GPS goed');
    expect(html).toContain('SOG');
  });

  it('distinguishes unavailable speed from a measured zero', () => {
    vi.useFakeTimers().setSystemTime(new Date(location.timestamp));
    expect(renderToStaticMarkup(<InstrumentPanel location={null} />)).toContain(
      'niet beschikbaar',
    );
    expect(
      renderToStaticMarkup(
        <InstrumentPanel location={{ ...location, speedMetersPerSecond: 0 }} />,
      ),
    ).toContain('0,0 knopen');
  });

  it('marks stale fixes unavailable and retains the development warning', () => {
    vi.stubGlobal('__DEV__', true);
    vi.useFakeTimers().setSystemTime(Date.parse(location.timestamp) + 11_000);
    const html = renderToStaticMarkup(
      <InstrumentPanel location={{ ...location, source: 'development' }} />,
    );
    expect(html).toContain('niet beschikbaar');
    expect(html).toContain('DEV - GPS verouderd');
    expect(html).toContain('--');
  });

  it('warns about poor accuracy without discarding available speed', () => {
    vi.useFakeTimers().setSystemTime(new Date(location.timestamp));
    const html = renderToStaticMarkup(
      <InstrumentPanel location={{ ...location, accuracyMeters: 100 }} />,
    );
    expect(html).toContain('3,9 knopen');
    expect(html).toContain('GPS onnauwkeurig');
  });
});
