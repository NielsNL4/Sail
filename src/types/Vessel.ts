import type { Coordinates } from './Location';

export interface AISBoundingBox {
  northEast: Coordinates;
  southWest: Coordinates;
}

export interface VesselDimensions {
  lengthMeters: number | null;
  widthMeters: number | null;
}

export interface AISVessel {
  mmsi: string;
  name: string | null;
  coordinates: Coordinates;
  speedKnots: number | null;
  courseDegrees: number | null;
  headingDegrees: number | null;
  shipType: number | null;
  dimensions: VesselDimensions | null;
  lastUpdate: string;
}

export type AISConnectionStatus =
  'disconnected' | 'connecting' | 'connected' | 'error';
