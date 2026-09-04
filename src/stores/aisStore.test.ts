import { beforeEach, describe, expect, it } from 'vitest';

import type { AISVessel } from '@/types';

import { useAISStore } from './aisStore';

const vessel: AISVessel = {
  mmsi: '244123456',
  name: 'Testschip',
  coordinates: { latitude: 52.4, longitude: 4.9 },
  speedKnots: 5,
  courseDegrees: 90,
  headingDegrees: 91,
  shipType: 36,
  dimensions: null,
  lastUpdate: '2026-09-04T12:00:00.000Z',
};

describe('aisStore', () => {
  beforeEach(() => useAISStore.getState().clear());

  it('updates vessels by MMSI while retaining known static data', () => {
    useAISStore.getState().applyUpdates([vessel]);
    useAISStore.getState().applyUpdates([
      {
        ...vessel,
        name: null,
        shipType: null,
        speedKnots: 7,
        lastUpdate: '2026-09-04T12:01:00.000Z',
      },
    ]);

    expect(useAISStore.getState().vessels[vessel.mmsi]).toMatchObject({
      name: 'Testschip',
      shipType: 36,
      speedKnots: 7,
    });
  });

  it('expires reports older than the cutoff', () => {
    useAISStore.getState().applyUpdates([vessel]);
    useAISStore.getState().expireBefore(Date.parse('2026-09-04T12:00:01.000Z'));

    expect(useAISStore.getState().vessels).toEqual({});
  });
});
