import type { AxiosInstance } from 'axios';

import type { NavigationMarker, NavigationQuery } from '@/types';

import { apiClient } from './apiClient';

const BASE_URL = 'https://api.pdok.nl/rws/vaarwegmarkeringen-nederland/ogc/v1';
const COLLECTIONS = {
  buoy: 'vaarweg_markeringen_drijvend_rd',
  beacon: 'vaarweg_markeringen_vast_rd',
} as const;

export interface NavigationMarkersService {
  getMarkers: (query: NavigationQuery) => Promise<NavigationMarker[]>;
}

interface FeaturePage {
  features?: unknown[];
  links?: { rel?: string; href?: string }[];
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.trim() !== '#'
    ? value.trim()
    : null;
}

function coordinateFromGeometry(
  geometry: unknown,
): { latitude: number; longitude: number } | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  const point =
    Array.isArray(coordinates) && Array.isArray(coordinates[0])
      ? coordinates[0]
      : coordinates;
  if (
    !Array.isArray(point) ||
    typeof point[0] !== 'number' ||
    typeof point[1] !== 'number'
  )
    return null;
  return { longitude: point[0], latitude: point[1] };
}

function normalizeFeature(
  feature: unknown,
  type: NavigationMarker['type'],
  fetchedAt: string,
): NavigationMarker | null {
  if (!feature || typeof feature !== 'object') return null;
  const record = feature as {
    id?: unknown;
    properties?: Record<string, unknown>;
    geometry?: unknown;
  };
  const position = coordinateFromGeometry(record.geometry);
  if (typeof record.id !== 'string' || !position) return null;
  const properties = record.properties ?? {};
  const isBuoy = type === 'buoy';
  return {
    id: `${type}-${record.id}`,
    type,
    position,
    name: stringValue(properties.benaming),
    number:
      stringValue(properties.benam_cod) ?? stringValue(properties.licht_nr),
    description:
      stringValue(properties.obj_soort) ?? stringValue(properties.naut_funct),
    waterway: stringValue(properties.vaarwater),
    category:
      stringValue(properties.iala_categorie) ??
      stringValue(properties.iala_cat),
    shape:
      stringValue(properties.obj_vorm) ?? stringValue(properties.object_vorm_o),
    color:
      stringValue(properties.obj_kleur) ?? stringValue(properties.vorm_kleur),
    colorPattern:
      stringValue(properties.kleurpatr) ?? stringValue(properties.kleurpatr_),
    light: isBuoy
      ? stringValue(properties.licht_klr)
      : (stringValue(properties.licht_kl) ?? stringValue(properties.licht_hgt)),
    fetchedAt,
  };
}

export function createNavigationMarkersService(
  client: Pick<AxiosInstance, 'get'>,
): NavigationMarkersService {
  return {
    async getMarkers({ region, signal }) {
      const fetchedAt = new Date().toISOString();
      const bbox = [
        region.longitude - region.longitudeDelta / 2,
        region.latitude - region.latitudeDelta / 2,
        region.longitude + region.longitudeDelta / 2,
        region.latitude + region.latitudeDelta / 2,
      ].join(',');
      const results = await Promise.all(
        (
          Object.entries(COLLECTIONS) as [NavigationMarker['type'], string][]
        ).map(async ([type, collection]) => {
          const features: unknown[] = [];
          let nextUrl: string | null =
            `${BASE_URL}/collections/${collection}/items`;
          let params: Record<string, string | number> = {
            bbox,
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
            .map((feature) => normalizeFeature(feature, type, fetchedAt))
            .filter((feature): feature is NavigationMarker => feature !== null);
        }),
      );
      return results.flat();
    },
  };
}

export const navigationMarkersService =
  createNavigationMarkersService(apiClient);
