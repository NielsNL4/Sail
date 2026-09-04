import type { AxiosInstance } from 'axios';

import type { CemtClass, FairwaySegment, NavigationQuery } from '@/types';

import { apiClient } from './apiClient';

const BASE_URL =
  'https://api.pdok.nl/rws/vaarweg-netwerk-data-service-bevaarbaarheid/ogc/v1';
const COLLECTION = 'l_navigability';

export interface FairwayNetworkService {
  getSegments: (query: NavigationQuery) => Promise<FairwaySegment[]>;
}

interface FeaturePage {
  features?: unknown[];
  links?: { rel?: string; href?: string }[];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseCemtClass(code: unknown, description: unknown): CemtClass {
  const codeSource = typeof code === 'string' ? code.toUpperCase() : '';
  const descriptionSource =
    typeof description === 'string' ? description.toUpperCase() : '';
  const codeMatch = codeSource.match(
    /^(?:_|\s)*(VIC|VI|V|IV|III|II|I|0)(?:_|\s|$)/,
  );
  const descriptionMatch = descriptionSource.match(
    /\b(VIC|VI|V|IV|III|II|I|0)\b/,
  );
  const value = codeMatch?.[1] ?? descriptionMatch?.[1] ?? '';
  if (value === 'VIC') return 'VIc';
  if (['VI', 'V', 'IV', 'III', 'II', 'I', '0'].includes(value))
    return value as CemtClass;
  return 'unknown';
}

function normalizeFeature(
  feature: unknown,
  fetchedAt: string,
): FairwaySegment | null {
  if (!feature || typeof feature !== 'object') return null;
  const record = feature as {
    id?: unknown;
    properties?: Record<string, unknown>;
    geometry?: unknown;
  };
  const geometry = record.geometry as GeoJSON.MultiLineString | undefined;
  if (typeof record.id !== 'string' || geometry?.type !== 'MultiLineString')
    return null;
  const properties = record.properties ?? {};
  const code = stringValue(properties.code);
  const description = stringValue(properties.description);
  return {
    id: record.id,
    geometry,
    cemtClass: parseCemtClass(code, description),
    name: stringValue(properties.name),
    description,
    code,
    fetchedAt,
  };
}

export function createFairwayNetworkService(
  client: Pick<AxiosInstance, 'get'>,
): FairwayNetworkService {
  return {
    async getSegments({ region, signal }) {
      const fetchedAt = new Date().toISOString();
      const features: unknown[] = [];
      let nextUrl: string | null =
        `${BASE_URL}/collections/${COLLECTION}/items`;
      let params: Record<string, string | number> = {
        bbox: [
          region.longitude - region.longitudeDelta / 2,
          region.latitude - region.latitudeDelta / 2,
          region.longitude + region.longitudeDelta / 2,
          region.latitude + region.latitudeDelta / 2,
        ].join(','),
        f: 'json',
        limit: 10_000,
      };

      while (nextUrl) {
        const response: { data: FeaturePage } = await client.get(nextUrl, {
          signal,
          timeout: 12_000,
          params,
        });
        features.push(...(response.data.features ?? []));
        nextUrl =
          response.data.links?.find((link) => link.rel === 'next')?.href ??
          null;
        params = {};
      }

      return features
        .map((feature) => normalizeFeature(feature, fetchedAt))
        .filter((feature): feature is FairwaySegment => feature !== null);
    },
  };
}

export const fairwayNetworkService = createFairwayNetworkService(apiClient);
