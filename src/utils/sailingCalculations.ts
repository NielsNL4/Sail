import type {
  Coordinates,
  NavigationMetrics,
  SailingGuidance,
  SailingOverlay,
  SailingProfile,
  SailingTack,
  WindData,
} from '@/types';

import {
  FUTURE_TIMESTAMP_TOLERANCE_MS,
  WEATHER_FRESHNESS_MS,
} from './freshness';
import {
  destinationCoordinates,
  normalizeDegrees,
  smallestAngleDifference,
  speedMetersPerSecondToKnots,
} from './navigationCalculations';
import { distanceInNauticalMiles } from './coordinates';

interface SailingGuidanceInput {
  navigation: NavigationMetrics;
  profile: SailingProfile;
  weatherStale?: boolean;
  wind: WindData;
  windFetchedAt: string;
  windValidAt: string;
  nowMs?: number;
}

interface RayIntersection {
  distanceFromStartNm: number;
  distanceFromTargetNm: number;
}

const RECOMMENDATION_DIFFERENCE = 0.02;

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function tackForCourse(
  windFromDegrees: number,
  courseDegrees: number | null,
): SailingTack | null {
  if (courseDegrees === null) return null;
  const windSide = smallestAngleDifference(windFromDegrees, courseDegrees);
  if (Math.abs(windSide) < 1 || Math.abs(windSide) > 179) return null;
  return windSide > 0 ? 'starboard' : 'port';
}

export function calculateSailingGuidance({
  navigation,
  profile,
  weatherStale = false,
  wind,
  windFetchedAt,
  windValidAt,
  nowMs = Date.now(),
}: SailingGuidanceInput): SailingGuidance {
  const windFromDegrees = normalizeDegrees(wind.directionDegrees);
  const windSpeedKnots = speedMetersPerSecondToKnots(wind.speedMetersPerSecond);
  const windGustKnots =
    wind.gustMetersPerSecond === null
      ? null
      : speedMetersPerSecondToKnots(wind.gustMetersPerSecond);
  const fetchedAtMs = Date.parse(windFetchedAt);
  const validAtMs = Date.parse(windValidAt);
  const fetchedAgeMs = nowMs - fetchedAtMs;
  const windIsStale =
    weatherStale ||
    !Number.isFinite(fetchedAtMs) ||
    fetchedAgeMs < -FUTURE_TIMESTAMP_TOLERANCE_MS ||
    fetchedAgeMs >= WEATHER_FRESHNESS_MS ||
    !Number.isFinite(validAtMs) ||
    Math.abs(nowMs - validAtMs) >= 90 * 60 * 1_000;
  const navigationAvailable = navigation.gpsQuality === 'good';
  const quality = windIsStale
    ? ('stale' as const)
    : navigationAvailable
      ? ('estimated' as const)
      : ('unavailable' as const);
  const relativeWindAngleToCourseDegrees =
    navigation.cogDegrees === null
      ? null
      : Math.abs(
          smallestAngleDifference(windFromDegrees, navigation.cogDegrees),
        );
  const relativeWindAngleToWaypointDegrees = Math.abs(
    smallestAngleDifference(
      windFromDegrees,
      navigation.bearingToWaypointDegrees,
    ),
  );
  const destinationInNoGoZone =
    relativeWindAngleToWaypointDegrees < profile.closeHauledAngleDegrees;
  const portTackHeadingDegrees =
    quality === 'estimated'
      ? normalizeDegrees(windFromDegrees + profile.closeHauledAngleDegrees)
      : null;
  const starboardTackHeadingDegrees =
    quality === 'estimated'
      ? normalizeDegrees(windFromDegrees - profile.closeHauledAngleDegrees)
      : null;
  let recommendedHeadingDegrees: number | null = null;
  let recommendedTack: SailingTack | null = null;

  if (quality === 'estimated') {
    if (
      destinationInNoGoZone &&
      portTackHeadingDegrees !== null &&
      starboardTackHeadingDegrees !== null
    ) {
      const portProgress = Math.cos(
        degreesToRadians(
          smallestAngleDifference(
            portTackHeadingDegrees,
            navigation.bearingToWaypointDegrees,
          ),
        ),
      );
      const starboardProgress = Math.cos(
        degreesToRadians(
          smallestAngleDifference(
            starboardTackHeadingDegrees,
            navigation.bearingToWaypointDegrees,
          ),
        ),
      );

      if (
        Math.abs(portProgress - starboardProgress) >= RECOMMENDATION_DIFFERENCE
      ) {
        recommendedTack =
          portProgress > starboardProgress ? 'port' : 'starboard';
        recommendedHeadingDegrees =
          recommendedTack === 'port'
            ? portTackHeadingDegrees
            : starboardTackHeadingDegrees;
      }
    } else {
      recommendedHeadingDegrees = navigation.bearingToWaypointDegrees;
    }
  }

  const vmgToWindKnots =
    quality === 'estimated' &&
    navigation.sogKnots !== null &&
    navigation.cogDegrees !== null
      ? navigation.sogKnots *
        Math.cos(
          degreesToRadians(
            smallestAngleDifference(navigation.cogDegrees, windFromDegrees),
          ),
        )
      : null;

  return {
    quality,
    windFromDegrees,
    windSpeedKnots,
    windGustKnots,
    windValidAt,
    windFetchedAt,
    relativeWindAngleToCourseDegrees,
    relativeWindAngleToWaypointDegrees,
    currentTack:
      quality === 'estimated'
        ? tackForCourse(windFromDegrees, navigation.cogDegrees)
        : null,
    destinationInNoGoZone,
    portTackHeadingDegrees,
    starboardTackHeadingDegrees,
    recommendedHeadingDegrees,
    recommendedTack,
    vmgToWindKnots,
  };
}

function headingVector(headingDegrees: number): { x: number; y: number } {
  const heading = degreesToRadians(headingDegrees);
  return { x: Math.sin(heading), y: Math.cos(heading) };
}

function cross(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return first.x * second.y - first.y * second.x;
}

function intersectRays(
  targetEastNm: number,
  targetNorthNm: number,
  startHeadingDegrees: number,
  reverseTargetHeadingDegrees: number,
): RayIntersection | null {
  const startRay = headingVector(startHeadingDegrees);
  const targetRay = headingVector(reverseTargetHeadingDegrees);
  const target = { x: targetEastNm, y: targetNorthNm };
  const denominator = cross(startRay, targetRay);
  if (Math.abs(denominator) < 1e-8) return null;

  const distanceFromStartNm = cross(target, targetRay) / denominator;
  const distanceFromTargetNm = cross(target, startRay) / denominator;
  if (distanceFromStartNm < 0 || distanceFromTargetNm < 0) return null;

  return { distanceFromStartNm, distanceFromTargetNm };
}

export function createSailingOverlay(
  current: Coordinates,
  target: Coordinates,
  guidance: SailingGuidance,
): SailingOverlay | null {
  const portHeading = guidance.portTackHeadingDegrees;
  const starboardHeading = guidance.starboardTackHeadingDegrees;
  if (
    guidance.quality !== 'estimated' ||
    portHeading === null ||
    starboardHeading === null
  ) {
    return null;
  }

  const distanceNm = distanceInNauticalMiles(current, target);
  let laylineLengthNm = Math.max(0.5, Math.min(20, distanceNm * 1.5));
  const noGoRadiusNm = Math.max(0.2, Math.min(1, distanceNm * 0.25));
  const noGoHalfAngle = Math.abs(
    smallestAngleDifference(guidance.windFromDegrees, starboardHeading),
  );
  const noGoZone = [
    current,
    ...Array.from({ length: 17 }, (_, index) =>
      destinationCoordinates(
        current,
        starboardHeading + (index / 16) * 2 * noGoHalfAngle,
        noGoRadiusNm,
      ),
    ),
    current,
  ];
  let recommendedTackPoint: Coordinates | null = null;

  if (guidance.destinationInNoGoZone && guidance.recommendedTack) {
    const referenceLatitude = degreesToRadians(
      (current.latitude + target.latitude) / 2,
    );
    const targetNorthNm = (target.latitude - current.latitude) * 60;
    const targetEastNm =
      smallestAngleDifference(target.longitude, current.longitude) *
      60 *
      Math.cos(referenceLatitude);
    const startsOnPort = guidance.recommendedTack === 'port';
    const startHeading = startsOnPort ? portHeading : starboardHeading;
    const finalHeading = startsOnPort ? starboardHeading : portHeading;
    const intersection = intersectRays(
      targetEastNm,
      targetNorthNm,
      startHeading,
      finalHeading + 180,
    );

    if (intersection) {
      laylineLengthNm = Math.max(
        laylineLengthNm,
        intersection.distanceFromTargetNm,
      );
      recommendedTackPoint = destinationCoordinates(
        current,
        startHeading,
        intersection.distanceFromStartNm,
      );
    }
  }

  const portLaylineStart = destinationCoordinates(
    target,
    portHeading + 180,
    laylineLengthNm,
  );
  const starboardLaylineStart = destinationCoordinates(
    target,
    starboardHeading + 180,
    laylineLengthNm,
  );

  return {
    noGoZone,
    portLayline: [portLaylineStart, target],
    starboardLayline: [starboardLaylineStart, target],
    recommendedTackPoint,
  };
}
