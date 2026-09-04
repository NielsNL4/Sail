import type {
  AISVessel,
  FairwaySegment,
  Coordinates,
  DepthMode,
  LocationData,
  MapRegion,
  NavigationMarker,
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
  fairways: FairwaySegment[];
  fairwaysVisible: boolean;
  markers: NavigationMarker[];
  markersVisible: boolean;
  onFairwayPress: (id: string) => void;
  onMarkerPress: (id: string) => void;
}
