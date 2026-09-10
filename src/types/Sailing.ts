import type { Coordinates } from './Location';

export interface SailingProfile {
  closeHauledAngleDegrees: number;
}

export type SailingTack = 'port' | 'starboard';
export type SailingGuidanceQuality = 'estimated' | 'stale' | 'unavailable';

export interface SailingGuidance {
  quality: SailingGuidanceQuality;
  windFromDegrees: number;
  windSpeedKnots: number;
  windGustKnots: number | null;
  windValidAt: string;
  windFetchedAt: string;
  relativeWindAngleToCourseDegrees: number | null;
  relativeWindAngleToWaypointDegrees: number;
  currentTack: SailingTack | null;
  destinationInNoGoZone: boolean;
  portTackHeadingDegrees: number | null;
  starboardTackHeadingDegrees: number | null;
  recommendedHeadingDegrees: number | null;
  recommendedTack: SailingTack | null;
  vmgToWindKnots: number | null;
}

export interface SailingOverlay {
  noGoZone: Coordinates[];
  portLayline: Coordinates[];
  starboardLayline: Coordinates[];
  recommendedTackPoint: Coordinates | null;
}
