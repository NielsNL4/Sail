export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends Coordinates {
  latitudeDelta: number;
  longitudeDelta: number;
}

export type LocationSource = 'device' | 'development';

export interface LocationData {
  coordinates: Coordinates;
  accuracyMeters: number | null;
  altitudeMeters: number | null;
  headingDegrees: number | null;
  speedMetersPerSecond: number | null;
  timestamp: string;
  isMocked: boolean;
  source: LocationSource;
}

export type LocationPermissionStatus = 'undetermined' | 'granted' | 'denied';
