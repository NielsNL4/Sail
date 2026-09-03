import type { Coordinates } from './Location';

export type WaterProviderId = 'rijkswaterstaat';

export interface DepthZone {
  id: string;
  boundary: Coordinates[];
  labelCoordinates: Coordinates;
  depthMeters: number;
  measuredAt: string | null;
}

export interface DepthData {
  zones: DepthZone[];
  provider: WaterProviderId;
  fetchedAt: string;
  isCached: boolean;
}
