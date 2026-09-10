import type {
  Coordinates,
  GpsQuality,
  LocationData,
  NavigationMetrics,
  NavigationSession,
} from '@/types';

import { distanceInNauticalMiles, initialBearingDegrees } from './coordinates';

const EARTH_RADIUS_NAUTICAL_MILES = 3440.065;
const METERS_PER_SECOND_TO_KNOTS = 1.9438444924;
const MIN_COURSE_SPEED_KNOTS = 0.5;
const MIN_ETA_VMG_KNOTS = 0.1;

export const GPS_STALE_AFTER_MS = 10_000;
export const GPS_POOR_ACCURACY_METERS = 50;
export const NAVIGATION_PROJECTION_MINUTES = 15;
export const ARRIVAL_RADIUS_METERS = 50;
export const ARRIVAL_FIX_COUNT = 3;
export const TRACK_MIN_DISTANCE_METERS = 10;
export const TRACK_MAX_INTERVAL_MS = 10_000;
export const MAX_TRACK_POINTS = 2_000;

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function smallestAngleDifference(
  firstDegrees: number,
  secondDegrees: number,
): number {
  return ((firstDegrees - secondDegrees + 540) % 360) - 180;
}

export function speedMetersPerSecondToKnots(speed: number): number {
  return speed * METERS_PER_SECOND_TO_KNOTS;
}

export function destinationCoordinates(
  from: Coordinates,
  bearingDegrees: number,
  distanceNm: number,
): Coordinates {
  const angularDistance = distanceNm / EARTH_RADIUS_NAUTICAL_MILES;
  const bearing = degreesToRadians(bearingDegrees);
  const fromLatitude = degreesToRadians(from.latitude);
  const fromLongitude = degreesToRadians(from.longitude);
  const latitude = Math.asin(
    Math.sin(fromLatitude) * Math.cos(angularDistance) +
      Math.cos(fromLatitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const longitude =
    fromLongitude +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(fromLatitude),
      Math.cos(angularDistance) - Math.sin(fromLatitude) * Math.sin(latitude),
    );

  return {
    latitude: radiansToDegrees(latitude),
    longitude: smallestAngleDifference(radiansToDegrees(longitude), 0),
  };
}

export function crossTrackErrorNm(
  routeStart: Coordinates,
  routeEnd: Coordinates,
  position: Coordinates,
): number {
  const angularDistance =
    distanceInNauticalMiles(routeStart, position) / EARTH_RADIUS_NAUTICAL_MILES;
  const positionBearing = degreesToRadians(
    initialBearingDegrees(routeStart, position),
  );
  const routeBearing = degreesToRadians(
    initialBearingDegrees(routeStart, routeEnd),
  );

  return (
    Math.asin(
      Math.sin(angularDistance) * Math.sin(positionBearing - routeBearing),
    ) * EARTH_RADIUS_NAUTICAL_MILES
  );
}

export function gpsQuality(
  location: LocationData | null,
  nowMs = Date.now(),
): GpsQuality {
  if (!location) return 'unavailable';
  if (location.isMocked && location.source !== 'development') return 'mocked';
  const timestampMs = Date.parse(location.timestamp);
  const ageMs = nowMs - timestampMs;
  if (
    !Number.isFinite(timestampMs) ||
    ageMs < -5_000 ||
    ageMs > GPS_STALE_AFTER_MS
  )
    return 'stale';
  if (
    location.accuracyMeters === null ||
    location.accuracyMeters > GPS_POOR_ACCURACY_METERS
  ) {
    return 'poor';
  }
  return 'good';
}

export function calculateNavigationMetrics(
  location: LocationData,
  session: NavigationSession,
  nowMs = Date.now(),
): NavigationMetrics {
  const quality = gpsQuality(location, nowMs);
  const distanceToWaypointNm = distanceInNauticalMiles(
    location.coordinates,
    session.target.coordinates,
  );
  const bearingToWaypointDegrees = initialBearingDegrees(
    location.coordinates,
    session.target.coordinates,
  );
  const rawSogKnots =
    location.speedMetersPerSecond === null || location.speedMetersPerSecond < 0
      ? null
      : speedMetersPerSecondToKnots(location.speedMetersPerSecond);
  const courseIsUsable =
    (quality === 'good' || quality === 'poor') &&
    rawSogKnots !== null &&
    rawSogKnots >= MIN_COURSE_SPEED_KNOTS &&
    location.headingDegrees !== null &&
    location.headingDegrees >= 0;
  const cogDegrees =
    courseIsUsable && location.headingDegrees !== null
      ? normalizeDegrees(location.headingDegrees)
      : null;
  const sogKnots =
    quality === 'good' || quality === 'poor' ? rawSogKnots : null;
  const vmgToWaypointKnots =
    sogKnots !== null && cogDegrees !== null
      ? sogKnots *
        Math.cos(
          degreesToRadians(
            smallestAngleDifference(cogDegrees, bearingToWaypointDegrees),
          ),
        )
      : null;
  const eta =
    vmgToWaypointKnots !== null &&
    vmgToWaypointKnots >= MIN_ETA_VMG_KNOTS &&
    quality === 'good'
      ? new Date(
          nowMs + (distanceToWaypointNm / vmgToWaypointKnots) * 3_600_000,
        ).toISOString()
      : null;
  const projectedCoordinates =
    sogKnots !== null && cogDegrees !== null
      ? destinationCoordinates(
          location.coordinates,
          cogDegrees,
          sogKnots * (NAVIGATION_PROJECTION_MINUTES / 60),
        )
      : null;

  return {
    sogKnots,
    cogDegrees,
    bearingToWaypointDegrees,
    distanceToWaypointNm,
    vmgToWaypointKnots,
    eta,
    crossTrackErrorNm: session.startCoordinates
      ? crossTrackErrorNm(
          session.startCoordinates,
          session.target.coordinates,
          location.coordinates,
        )
      : null,
    projectedCoordinates,
    gpsQuality: quality,
  };
}
