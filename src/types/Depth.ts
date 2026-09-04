import type { Coordinates } from './Location';

export type WaterProviderId = 'rijkswaterstaat';
export type DepthSampleSource = 'inland-1m' | 'coastal-20m';

export interface DepthSample {
  id: string;
  coordinates: Coordinates;
  bottomElevationMetersNap: number;
  measuredAt: string | null;
  source: DepthSampleSource;
}
