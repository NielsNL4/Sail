import type { CemtClass, FairwaySegment, VesselProfile } from '@/types';

interface CemtLimits {
  draftMeters: number;
  beamMeters: number;
  lengthMeters: number;
}

// Indicative CEMT limits used for visual warnings, not navigation clearance.
const CEMT_LIMITS: Record<Exclude<CemtClass, 'unknown'>, CemtLimits> = {
  '0': { draftMeters: 1.5, beamMeters: 6, lengthMeters: 25 },
  I: { draftMeters: 2.2, beamMeters: 5.5, lengthMeters: 70 },
  II: { draftMeters: 2.5, beamMeters: 6.6, lengthMeters: 86 },
  III: { draftMeters: 2.7, beamMeters: 7, lengthMeters: 86 },
  IV: { draftMeters: 2.8, beamMeters: 9.5, lengthMeters: 105 },
  V: { draftMeters: 3.5, beamMeters: 11.4, lengthMeters: 172 },
  VI: { draftMeters: 4.5, beamMeters: 15, lengthMeters: 185 },
  VIc: { draftMeters: 4.5, beamMeters: 22.9, lengthMeters: 185 },
};

export function vesselProfileIsEmpty(profile: VesselProfile): boolean {
  return Object.values(profile).every((value) => value === null);
}

export function fairwayIsUnsuitable(
  fairway: FairwaySegment,
  profile: VesselProfile,
): boolean {
  if (vesselProfileIsEmpty(profile) || fairway.cemtClass === 'unknown') {
    return false;
  }

  const limits = CEMT_LIMITS[fairway.cemtClass];
  return (
    (profile.draftMeters !== null &&
      profile.draftMeters > limits.draftMeters) ||
    (profile.beamMeters !== null && profile.beamMeters > limits.beamMeters) ||
    (profile.lengthMeters !== null &&
      profile.lengthMeters > limits.lengthMeters)
  );
}
