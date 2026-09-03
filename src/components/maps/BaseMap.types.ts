import type { LocationData, MapRegion } from '@/types';

export interface BaseMapProps {
  initialRegion: MapRegion;
  location: LocationData | null;
  focusRequestId: number;
  locationTitle: string;
}
