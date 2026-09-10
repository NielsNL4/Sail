import type { Coordinates, GpsQuality, LocationData } from '../types';
import {
  destinationCoordinates,
  GPS_POOR_ACCURACY_METERS,
  GPS_STALE_AFTER_MS,
  normalizeDegrees,
  speedMetersPerSecondToKnots,
} from './navigationCalculations';

export interface OwnMotion {
  sogKnots: number | null;
  cogDegrees: number | null;
  gpsQuality: GpsQuality;
}

export function isOwnLocationVisible(
  location: LocationData | null,
): location is LocationData {
  if (!location) return false;
  if (
    location.source === 'development' &&
    !(typeof __DEV__ !== 'undefined' && __DEV__)
  )
    return false;
  const { latitude, longitude } = location.coordinates;
  return (
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180
  );
}

/** Session-independent GPS motion. Development fixes are trusted only in dev builds. */
export function calculateOwnMotion(
  location: LocationData | null,
  nowMs = Date.now(),
): OwnMotion {
  const unavailable: OwnMotion = {
    sogKnots: null,
    cogDegrees: null,
    gpsQuality: 'unavailable',
  };
  if (!isOwnLocationVisible(location)) return unavailable;
  const ageMs = nowMs - Date.parse(location.timestamp);
  let quality: GpsQuality;
  if (location.isMocked && location.source !== 'development')
    quality = 'mocked';
  else if (
    !Number.isFinite(ageMs) ||
    ageMs < -5_000 ||
    ageMs > GPS_STALE_AFTER_MS
  )
    quality = 'stale';
  else if (
    location.accuracyMeters === null ||
    !Number.isFinite(location.accuracyMeters) ||
    location.accuracyMeters < 0 ||
    location.accuracyMeters > GPS_POOR_ACCURACY_METERS
  )
    quality = 'poor';
  else quality = 'good';
  if (quality !== 'good' && quality !== 'poor')
    return { ...unavailable, gpsQuality: quality };
  const speed = location.speedMetersPerSecond;
  const convertedSpeed =
    speed === null ? NaN : speedMetersPerSecondToKnots(speed);
  const sogKnots =
    Number.isFinite(convertedSpeed) && convertedSpeed >= 0
      ? convertedSpeed
      : null;
  const heading = location.headingDegrees;
  const cogDegrees =
    sogKnots !== null &&
    sogKnots >= 0.5 &&
    heading !== null &&
    Number.isFinite(heading) &&
    heading >= 0 &&
    heading <= 360
      ? normalizeDegrees(heading)
      : null;
  return { sogKnots, cogDegrees, gpsQuality: quality };
}

export const OWN_VESSEL_SOURCE_ID = 'own-vessel-source';
export const OWN_VECTOR_SECONDS = 30;

type OwnVesselProperties = {
  kind: 'position' | 'vector';
  directional: boolean;
  rotation: number;
  color: string;
};

export function ownVesselToGeoJson(
  location: LocationData | null,
  nowMs = Date.now(),
): GeoJSON.FeatureCollection<
  GeoJSON.Point | GeoJSON.LineString,
  OwnVesselProperties
> {
  const features: GeoJSON.Feature<
    GeoJSON.Point | GeoJSON.LineString,
    OwnVesselProperties
  >[] = [];
  if (!isOwnLocationVisible(location))
    return { type: 'FeatureCollection', features };
  const motion = calculateOwnMotion(location, nowMs);
  const properties: OwnVesselProperties = {
    kind: 'position',
    directional: motion.cogDegrees !== null,
    rotation: motion.cogDegrees ?? 0,
    color:
      location.isMocked ||
      location.source === 'development' ||
      motion.gpsQuality !== 'good'
        ? '#f59e0b'
        : '#0284c7',
  };
  const from = location.coordinates;
  const position = [from.longitude, from.latitude];
  features.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: position },
    properties,
  });
  if (motion.cogDegrees !== null && motion.sogKnots !== null) {
    // Unwrap the endpoint to keep dateline crossings local rather than spanning the map.
    const to: Coordinates = destinationCoordinates(
      from,
      motion.cogDegrees,
      motion.sogKnots * (OWN_VECTOR_SECONDS / 3_600),
    );
    const longitude =
      from.longitude + ((to.longitude - from.longitude + 540) % 360) - 180;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [position, [longitude, to.latitude]],
      },
      properties: { ...properties, kind: 'vector' },
    });
  }
  return { type: 'FeatureCollection', features };
}
