import type { Coordinates } from './Location';

export type NavigationMarkerType = 'buoy' | 'beacon';

export interface NavigationMarker {
  id: string;
  type: NavigationMarkerType;
  position: Coordinates;
  name: string | null;
  number: string | null;
  description: string | null;
  waterway: string | null;
  category: string | null;
  shape: string | null;
  color: string | null;
  colorPattern: string | null;
  light: string | null;
  fetchedAt: string;
}
