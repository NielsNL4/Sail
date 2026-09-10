import type {
  AISVessel,
  BridgeLock,
  FairwaySegment,
  Coordinates,
  DepthMode,
  LocationData,
  MapRegion,
  MapStyleId,
  NavigationMarker,
  NavigationOverlay,
  SailingOverlay,
  VesselProfile,
  WindColorMode,
} from '@/types';

export interface BaseMapProps {
  initialRegion: MapRegion;
  location: LocationData | null;
  focusRequestId: number;
  locationTitle: string;
  depthMode: DepthMode;
  depthVisible: boolean;
  windVisible: boolean;
  mapStyle: MapStyleId;
  windColorMode: WindColorMode;
  networkAvailable: boolean;
  navigationOverlay: NavigationOverlay | null;
  sailingOverlay: SailingOverlay | null;
  destinationSelectionActive: boolean;
  calloutAnchor: Coordinates | null;
  onCalloutPointChange: (point: MapPressPoint | null) => void;
  onDepthPress: (
    coordinates: Coordinates,
    zoom: number,
    point: MapPressPoint,
  ) => void;
  onMapPress: (coordinates: Coordinates, point: MapPressPoint) => void;
  vessels: AISVessel[];
  vesselsVisible: boolean;
  onVesselPress: (
    mmsi: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => void;
  fairways: FairwaySegment[];
  fairwaysVisible: boolean;
  markers: NavigationMarker[];
  markersVisible: boolean;
  onFairwayPress: (
    id: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => void;
  onMarkerPress: (
    id: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => void;
  vesselProfile: VesselProfile;
  bridges: BridgeLock[];
  bridgesVisible: boolean;
  onBridgePress: (
    id: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => void;
}

export interface MapPressPoint {
  x: number;
  y: number;
}
