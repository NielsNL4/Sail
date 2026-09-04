import type { MapRegion } from './Location';

export type CemtClass =
  '0' | 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VIc' | 'unknown';

export interface FairwaySegment {
  id: string;
  geometry: GeoJSON.MultiLineString;
  cemtClass: CemtClass;
  name: string | null;
  description: string | null;
  code: string | null;
  fetchedAt: string;
}

export interface NavigationQuery {
  region: MapRegion;
  signal?: AbortSignal;
}
