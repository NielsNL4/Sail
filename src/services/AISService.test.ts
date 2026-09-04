import { describe, expect, it, vi } from 'vitest';

import { createAISService, normalizeAISMessage } from './AISService';

const positionReport = {
  MessageType: 'PositionReport',
  MetaData: {
    MMSI: 244123456,
    ShipName: 'TEST BOAT@@@@',
    latitude: 52.4,
    longitude: 4.9,
  },
  Message: {
    PositionReport: {
      Sog: 6.4,
      Cog: 182.5,
      TrueHeading: 181,
    },
  },
};

describe('AISService', () => {
  it('normalizes position reports and AIS unavailable values', () => {
    expect(
      normalizeAISMessage(positionReport, null, '2026-09-04T12:00:00.000Z'),
    ).toEqual({
      mmsi: '244123456',
      name: 'TEST BOAT',
      coordinates: { latitude: 52.4, longitude: 4.9 },
      speedKnots: 6.4,
      courseDegrees: 182.5,
      headingDegrees: 181,
      shipType: null,
      dimensions: null,
      lastUpdate: '2026-09-04T12:00:00.000Z',
    });

    expect(
      normalizeAISMessage({
        ...positionReport,
        Message: {
          PositionReport: { Sog: 102.3, Cog: 360, TrueHeading: 511 },
        },
      }),
    ).toMatchObject({
      speedKnots: null,
      courseDegrees: null,
      headingDegrees: null,
    });

    expect(
      normalizeAISMessage({
        ...positionReport,
        MetaData: {
          MMSI: 244123456,
          Latitude: 52.4,
          Longitude: 4.9,
        },
        Message: {
          PositionReport: {
            Sog: -1,
            Cog: -1,
            TrueHeading: -1,
            Valid: true,
          },
        },
      }),
    ).toMatchObject({
      coordinates: { latitude: 52.4, longitude: 4.9 },
      speedKnots: null,
      courseDegrees: null,
      headingDegrees: null,
    });

    expect(
      normalizeAISMessage({
        ...positionReport,
        Message: { PositionReport: { Valid: false } },
      }),
    ).toBeNull();
  });

  it('subscribes with viewport bounds and emits incoming vessels', async () => {
    const sockets: {
      readyState: number;
      close: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      onopen: (() => void) | null;
      onclose: (() => void) | null;
      onerror: (() => void) | null;
      onmessage: ((event: { data: unknown }) => void) | null;
    }[] = [];
    const service = createAISService('ws://relay', () => {
      const socket = {
        readyState: 0,
        close: vi.fn(),
        send: vi.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };
      sockets.push(socket);
      return socket;
    });
    const listener = vi.fn();
    const statusListener = vi.fn();
    service.onVesselUpdate(listener);
    service.onStatusChange(statusListener);
    const bounds = {
      southWest: { latitude: 51, longitude: 3 },
      northEast: { latitude: 54, longitude: 7 },
    };

    service.connect(bounds);
    sockets[0].readyState = 1;
    sockets[0].onopen?.();
    expect(sockets[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'subscribe', boundingBox: bounds }),
    );
    expect(statusListener).not.toHaveBeenCalledWith('connected', null);

    sockets[0].onmessage?.({
      data: JSON.stringify({ type: 'status', status: 'connected' }),
    });
    await vi.waitFor(() =>
      expect(statusListener).toHaveBeenCalledWith('connected', null),
    );

    sockets[0].onmessage?.({ data: JSON.stringify(positionReport) });
    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(listener.mock.calls[0][0].mmsi).toBe('244123456');
  });

  it('enriches later positions with static vessel reports', async () => {
    const socket = {
      readyState: 0,
      close: vi.fn(),
      send: vi.fn(),
      onopen: null as (() => void) | null,
      onclose: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onmessage: null as ((event: { data: unknown }) => void) | null,
    };
    const service = createAISService('ws://relay', () => socket);
    const listener = vi.fn();
    service.onVesselUpdate(listener);
    service.connect({
      southWest: { latitude: 51, longitude: 3 },
      northEast: { latitude: 54, longitude: 7 },
    });
    socket.onmessage?.({
      data: JSON.stringify({
        MessageType: 'ShipStaticData',
        MetaData: { MMSI: 244123456 },
        Message: {
          ShipStaticData: {
            Name: 'STATIC NAME',
            Type: 36,
            Dimension: { A: 8, B: 4, C: 2, D: 2 },
          },
        },
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({
        ...positionReport,
        MetaData: { ...positionReport.MetaData, ShipName: '' },
      }),
    });

    await vi.waitFor(() => expect(listener).toHaveBeenCalledOnce());
    expect(listener.mock.calls[0][0]).toMatchObject({
      name: 'STATIC NAME',
      shipType: 36,
      dimensions: { lengthMeters: 12, widthMeters: 4 },
    });
  });

  it('reports a missing relay URL without opening a socket', () => {
    const factory = vi.fn();
    const status = vi.fn();
    const service = createAISService('', factory);
    service.onStatusChange(status);

    service.connect({
      southWest: { latitude: 51, longitude: 3 },
      northEast: { latitude: 54, longitude: 7 },
    });

    expect(factory).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith('error', 'AIS-relay URL ontbreekt.');
  });

  it('ignores close events from a replaced socket', () => {
    const sockets: {
      readyState: number;
      close: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      onopen: (() => void) | null;
      onclose: (() => void) | null;
      onerror: (() => void) | null;
      onmessage: ((event: { data: unknown }) => void) | null;
    }[] = [];
    const service = createAISService('ws://relay', () => {
      const socket = {
        readyState: 0,
        close: vi.fn(),
        send: vi.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };
      sockets.push(socket);
      return socket;
    });
    const bounds = {
      southWest: { latitude: 51, longitude: 3 },
      northEast: { latitude: 54, longitude: 7 },
    };

    service.connect(bounds);
    const staleClose = sockets[0].onclose;
    service.disconnect();
    service.connect(bounds);
    sockets[1].readyState = 1;
    sockets[1].onopen?.();
    staleClose?.();
    service.connect(bounds);

    expect(sockets).toHaveLength(2);
    expect(sockets[1].send).toHaveBeenCalledTimes(2);
  });
});
