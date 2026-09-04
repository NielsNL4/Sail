import type {
  AISVessel,
  Coordinates,
  DepthMode,
  LocationData,
  MapRegion,
} from '@/types';

export interface BaseMapProps {
  initialRegion: MapRegion;
  location: LocationData | null;
  focusRequestId: number;
  locationTitle: string;
  depthMode: DepthMode;
  networkAvailable: boolean;
  onDepthPress: (coordinates: Coordinates, zoom: number) => void;
  vessels: AISVessel[];
  vesselsVisible: boolean;
  onVesselPress: (mmsi: string) => void;
}
