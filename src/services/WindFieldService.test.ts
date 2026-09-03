import { describe, expect, it, vi } from 'vitest';

import {
  createWindFieldService,
  createWindGrid,
  normalizeWindField,
  windFieldGridSizeForZoom,
  windToVector,
} from './WindFieldService';

const region = {
  latitude: 53,
  longitude: 5,
  latitudeDelta: 2,
  longitudeDelta: 2,
};

function createResponse(index: number) {
  return {
    latitude: 52 + Math.floor(index / 5) * 0.5,
    longitude: 4 + (index % 5) * 0.5,
    current: {
      time: '2026-09-03T12:00',
      wind_speed_10m: 10,
      wind_direction_10m: 270,
    },
  };
}

describe('WindFieldService', () => {
  it('creates a row-major coordinate grid', () => {
    const grid = createWindGrid(region, 3, 3);

    expect(grid.coordinates).toEqual([
      [52, 4],
      [52, 5],
      [52, 6],
      [53, 4],
      [53, 5],
      [53, 6],
      [54, 4],
      [54, 5],
      [54, 6],
    ]);
  });

  it('converts meteorological direction to vector components', () => {
    const westWind = windToVector(10, 270);
    const northWind = windToVector(10, 0);

    expect(westWind.eastwardMetersPerSecond).toBeCloseTo(10);
    expect(westWind.northwardMetersPerSecond).toBeCloseTo(0);
    expect(northWind.eastwardMetersPerSecond).toBeCloseTo(0);
    expect(northWind.northwardMetersPerSecond).toBeCloseTo(-10);
  });

  it('normalizes a complete Open-Meteo grid', () => {
    const field = normalizeWindField(
      Array.from({ length: 25 }, (_, index) => createResponse(index)),
      region,
      5,
      5,
      '2026-09-03T12:01:00.000Z',
    );

    expect(field.vectors).toHaveLength(25);
    expect(field.bounds).toEqual({ west: 4, south: 52, east: 6, north: 54 });
    expect(field.validAt).toBe('2026-09-03T12:00:00.000Z');
    expect(field.vectors[0].eastwardMetersPerSecond).toBeCloseTo(10);
  });

  it('requests all grid coordinates in one API call', async () => {
    const responses = Array.from({ length: 25 }, (_, index) =>
      createResponse(index),
    );
    const get = vi.fn().mockResolvedValue({ data: responses });
    const service = createWindFieldService({ get });

    await service.getWindField(region);

    expect(get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          current: 'wind_speed_10m,wind_direction_10m',
          models: 'knmi_seamless',
          cell_selection: 'sea',
        }),
      }),
    );
    const params = get.mock.calls[0][1].params;
    expect(params.latitude.split(',')).toHaveLength(25);
    expect(params.longitude.split(',')).toHaveLength(25);
  });

  it('selects a denser grid for close-range views', () => {
    expect(windFieldGridSizeForZoom(11.99)).toBe(5);
    expect(windFieldGridSizeForZoom(12)).toBe(9);
    expect(windFieldGridSizeForZoom(18)).toBe(9);
  });

  it('requests and normalizes a custom grid size', async () => {
    const responses = Array.from({ length: 81 }, (_, index) =>
      createResponse(index),
    );
    const get = vi.fn().mockResolvedValue({ data: responses });
    const service = createWindFieldService({ get });

    const result = await service.getWindField(region, undefined, 9);
    const params = get.mock.calls[0][1].params;

    expect(params.latitude.split(',')).toHaveLength(81);
    expect(result.rows).toBe(9);
    expect(result.columns).toBe(9);
    expect(result.vectors).toHaveLength(81);
  });
});
