import type { AxiosInstance } from 'axios';

import type { MapRegion, WindField, WindVector } from '@/types';

import { apiClient } from './apiClient';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const DEFAULT_GRID_SIZE = 5;
const CLOSE_RANGE_GRID_SIZE = 9;
const CLOSE_RANGE_ZOOM = 12;

interface OpenMeteoWindResponse {
  latitude: number;
  longitude: number;
  current: {
    time: string;
    wind_speed_10m: number | null;
    wind_direction_10m: number | null;
  };
}

export interface WindFieldService {
  getWindField: (
    region: MapRegion,
    signal?: AbortSignal,
    gridSize?: number,
  ) => Promise<WindField>;
}

export function windFieldGridSizeForZoom(zoom: number): number {
  return zoom >= CLOSE_RANGE_ZOOM ? CLOSE_RANGE_GRID_SIZE : DEFAULT_GRID_SIZE;
}

export function windToVector(
  speedMetersPerSecond: number,
  directionDegrees: number,
) {
  const directionRadians = (directionDegrees * Math.PI) / 180;

  // Meteorological direction identifies where wind comes from.
  return {
    eastwardMetersPerSecond: -speedMetersPerSecond * Math.sin(directionRadians),
    northwardMetersPerSecond:
      -speedMetersPerSecond * Math.cos(directionRadians),
  };
}

export function createWindGrid(
  region: MapRegion,
  rows = DEFAULT_GRID_SIZE,
  columns = DEFAULT_GRID_SIZE,
) {
  const west = region.longitude - region.longitudeDelta / 2;
  const east = region.longitude + region.longitudeDelta / 2;
  const south = Math.max(-85, region.latitude - region.latitudeDelta / 2);
  const north = Math.min(85, region.latitude + region.latitudeDelta / 2);
  const coordinates: [number, number][] = [];

  for (let row = 0; row < rows; row += 1) {
    const latitude = south + ((north - south) * row) / (rows - 1);

    for (let column = 0; column < columns; column += 1) {
      const longitude = west + ((east - west) * column) / (columns - 1);
      coordinates.push([latitude, longitude]);
    }
  }

  return {
    bounds: { west, south, east, north },
    columns,
    rows,
    coordinates,
  };
}

function normalizeTime(value: string): string {
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Open-Meteo returned an invalid wind field time.');
  }

  return date.toISOString();
}

export function normalizeWindField(
  responses: OpenMeteoWindResponse[],
  region: MapRegion,
  rows = DEFAULT_GRID_SIZE,
  columns = DEFAULT_GRID_SIZE,
  fetchedAt = new Date().toISOString(),
): WindField {
  const grid = createWindGrid(region, rows, columns);

  if (responses.length !== grid.coordinates.length) {
    throw new Error('Open-Meteo returned an incomplete wind field.');
  }

  const vectors: WindVector[] = responses.map((response) => {
    const speed = response.current.wind_speed_10m;
    const direction = response.current.wind_direction_10m;

    if (speed === null || direction === null) {
      throw new Error('Open-Meteo returned incomplete wind vectors.');
    }

    return {
      coordinates: {
        latitude: response.latitude,
        longitude: response.longitude,
      },
      speedMetersPerSecond: speed,
      ...windToVector(speed, direction),
    };
  });

  return {
    bounds: grid.bounds,
    columns,
    rows,
    vectors,
    validAt: normalizeTime(responses[0].current.time),
    fetchedAt,
    provider: 'open-meteo',
  };
}

export function createWindFieldService(
  client: Pick<AxiosInstance, 'get'>,
): WindFieldService {
  return {
    async getWindField(region, signal, gridSize = DEFAULT_GRID_SIZE) {
      const grid = createWindGrid(region, gridSize, gridSize);
      const response = await client.get<
        OpenMeteoWindResponse | OpenMeteoWindResponse[]
      >(OPEN_METEO_FORECAST_URL, {
        signal,
        params: {
          latitude: grid.coordinates
            .map(([latitude]) => latitude.toFixed(4))
            .join(','),
          longitude: grid.coordinates
            .map(([, longitude]) => longitude.toFixed(4))
            .join(','),
          current: 'wind_speed_10m,wind_direction_10m',
          wind_speed_unit: 'ms',
          timezone: 'UTC',
          models: 'knmi_seamless',
          cell_selection: 'sea',
        },
      });
      const responses = Array.isArray(response.data)
        ? response.data
        : [response.data];

      return normalizeWindField(responses, region, gridSize, gridSize);
    },
  };
}

export const windFieldService = createWindFieldService(apiClient);
