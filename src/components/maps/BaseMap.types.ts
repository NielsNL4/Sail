import type { Coordinates, DepthMode, LocationData, MapRegion } from '@/types';

export interface BaseMapProps {
  initialRegion: MapRegion;
  location: LocationData | null;
  focusRequestId: number;
  locationTitle: string;
  depthMode: DepthMode;
  onDepthPress: (coordinates: Coordinates, zoom: number) => void;
}
