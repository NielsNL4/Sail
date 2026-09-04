import type { AxiosInstance } from 'axios';

import type { Coordinates, DepthSample, DepthSampleSource } from '@/types';

import { apiClient } from './apiClient';

const COASTAL_BATHYMETRY_WMS_URL =
  'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_20mtr/ows';
const INLAND_BATHYMETRY_WMS_URL =
  'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_1mtr_historie/ows';
const COASTAL_BATHYMETRY_LAYER = 'bodemhoogte_20mtr';
const INLAND_BATHYMETRY_LAYER = 'bodemhoogte_1mtr_202602';

export interface RijkswaterstaatService {
  getDepthAt: (
    coordinates: Coordinates,
    source: DepthSampleSource,
    signal?: AbortSignal,
  ) => Promise<DepthSample | null>;
}

function findNumericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (/^(gray_index|pixel_?value|value|band_?1|bodemhoogte)$/i.test(key)) {
      const numericValue = Number(nestedValue);

      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }

    const nestedResult = findNumericValue(nestedValue);

    if (nestedResult !== null) {
      return nestedResult;
    }
  }

  return null;
}

export function parseDepthSample(payload: unknown): number | null {
  const structuredValue = findNumericValue(payload);

  if (structuredValue !== null) {
    return structuredValue;
  }

  if (typeof payload !== 'string') {
    return null;
  }

  const match = payload.match(
    /(?:GRAY_INDEX|pixel\s*value|value|band_?1|bodemhoogte)["']?\s*[:=]\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/i,
  );

  if (!match) {
    return null;
  }

  const value = Number(match[1]);

  return Number.isFinite(value) ? value : null;
}

function sampleParams(latitude: number, longitude: number, layer: string) {
  const radius = 0.001;

  return {
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: [
      longitude - radius,
      latitude - radius,
      longitude + radius,
      latitude + radius,
    ].join(','),
    WIDTH: 3,
    HEIGHT: 3,
    X: 1,
    Y: 1,
    INFO_FORMAT: 'text/plain',
  };
}

async function requestDepthSample(
  client: Pick<AxiosInstance, 'get'>,
  coordinates: Coordinates,
  requestedSource: DepthSampleSource,
  signal?: AbortSignal,
): Promise<{ elevation: number; source: DepthSampleSource } | null> {
  const source =
    requestedSource === 'inland-1m'
      ? {
          source: requestedSource,
          url: INLAND_BATHYMETRY_WMS_URL,
          layer: INLAND_BATHYMETRY_LAYER,
        }
      : {
          source: requestedSource,
          url: COASTAL_BATHYMETRY_WMS_URL,
          layer: COASTAL_BATHYMETRY_LAYER,
        };
  const response = await client.get<unknown>(source.url, {
    signal,
    timeout: 4_000,
    'axios-retry': { retries: 0 },
    params: sampleParams(
      coordinates.latitude,
      coordinates.longitude,
      source.layer,
    ),
    responseType: 'text',
  });
  const elevation = parseDepthSample(response.data);

  return elevation !== null && elevation > -200 && elevation < 100
    ? { elevation, source: source.source }
    : null;
}

function toDepthSample(
  id: string,
  coordinates: Coordinates,
  result: { elevation: number; source: DepthSampleSource },
): DepthSample {
  return {
    id,
    coordinates,
    bottomElevationMetersNap: result.elevation,
    measuredAt: null,
    source: result.source,
  };
}

export function createRijkswaterstaatService(
  client: Pick<AxiosInstance, 'get'>,
): RijkswaterstaatService {
  return {
    async getDepthAt(coordinates, source, signal) {
      const result = await requestDepthSample(
        client,
        coordinates,
        source,
        signal,
      );

      return result
        ? toDepthSample(
            `selected-${coordinates.longitude}-${coordinates.latitude}`,
            coordinates,
            result,
          )
        : null;
    },
  };
}

export const rijkswaterstaatService = createRijkswaterstaatService(apiClient);
