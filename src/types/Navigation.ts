import type { Coordinates } from './Location';

export type WaypointCategory = 'anchorage' | 'marina' | 'hazard' | 'navigation';

export interface Waypoint {
  id: string;
  name: string;
  category: WaypointCategory;
  coordinates: Coordinates;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NavigationStatus =
  'idle' | 'acquiring' | 'navigating' | 'arrived' | 'error';

export type GpsQuality = 'unavailable' | 'mocked' | 'stale' | 'poor' | 'good';

export interface NavigationTarget {
  id: string;
  name: string;
  coordinates: Coordinates;
}

export interface TrackPoint extends Coordinates {
  accuracyMeters: number | null;
  timestamp: string;
}

export interface NavigationSession {
  target: NavigationTarget;
  startedAt: string;
  startCoordinates: Coordinates | null;
  track: TrackPoint[];
}

export interface NavigationMetrics {
  sogKnots: number | null;
  cogDegrees: number | null;
  bearingToWaypointDegrees: number;
  distanceToWaypointNm: number;
  vmgToWaypointKnots: number | null;
  eta: string | null;
  crossTrackErrorNm: number | null;
  projectedCoordinates: Coordinates | null;
  gpsQuality: GpsQuality;
}

export interface NavigationOverlay {
  currentCoordinates: Coordinates | null;
  projectedCoordinates: Coordinates | null;
  routeStartCoordinates: Coordinates | null;
  targetCoordinates: Coordinates;
  track: TrackPoint[];
}
