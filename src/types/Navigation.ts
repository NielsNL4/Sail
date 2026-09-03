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
