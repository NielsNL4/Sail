import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { strings } from '../i18n';
import { foregroundLocation } from '../services/foregroundLocation';
import { useLocationStore } from '../stores/locationStore';
import { useNavigationSessionStore } from '../stores/navigationSessionStore';
import type {
  LocationData,
  NavigationMetrics,
  NavigationTarget,
  TrackPoint,
} from '@/types';
import {
  ARRIVAL_FIX_COUNT,
  ARRIVAL_RADIUS_METERS,
  calculateNavigationMetrics,
  gpsQuality,
  TRACK_MAX_INTERVAL_MS,
  TRACK_MIN_DISTANCE_METERS,
} from '../utils/navigationCalculations';
import { distanceInNauticalMiles } from '../utils/coordinates';

export interface NavigationController {
  error: string | null;
  metrics: NavigationMetrics | null;
  session: ReturnType<typeof useNavigationSessionStore.getState>['session'];
  startNavigation: (target: NavigationTarget) => Promise<boolean>;
  status: ReturnType<typeof useNavigationSessionStore.getState>['status'];
  stopNavigation: () => void;
}

function shouldRecordTrackPoint(
  lastPoint: TrackPoint | undefined,
  location: LocationData,
): boolean {
  if (!lastPoint) return true;

  const distanceMeters =
    distanceInNauticalMiles(lastPoint, location.coordinates) * 1_852;
  const elapsedMs =
    Date.parse(location.timestamp) - Date.parse(lastPoint.timestamp);
  return (
    distanceMeters >= TRACK_MIN_DISTANCE_METERS ||
    elapsedMs >= TRACK_MAX_INTERVAL_MS
  );
}

export function useNavigationSession(): NavigationController {
  const status = useNavigationSessionStore((state) => state.status);
  const session = useNavigationSessionStore((state) => state.session);
  const error = useNavigationSessionStore((state) => state.error);
  const location = useLocationStore((state) => state.location);
  const [nowMs, setNowMs] = useState(Date.now);
  const requestGenerationRef = useRef(0);
  const arrivalFixesRef = useRef(0);

  const stopNavigation = () => {
    requestGenerationRef.current += 1;
    arrivalFixesRef.current = 0;
    useNavigationSessionStore.getState().stop();
  };

  const handleLocation = (nextLocation: LocationData) => {
    let navigationState = useNavigationSessionStore.getState();
    if (
      navigationState.status !== 'acquiring' &&
      navigationState.status !== 'navigating'
    )
      return;

    const developmentLocationAllowed =
      typeof __DEV__ !== 'undefined' &&
      __DEV__ &&
      nextLocation.source === 'development';
    if (nextLocation.isMocked && !developmentLocationAllowed) {
      useNavigationSessionStore
        .getState()
        .fail(strings.navigationMockedLocation);
      return;
    }

    if (!navigationState.session) return;

    if (navigationState.status === 'acquiring') {
      if (gpsQuality(nextLocation) !== 'good') return;
      navigationState.activate(nextLocation.coordinates);
      navigationState = useNavigationSessionStore.getState();
    }

    const lastPoint = navigationState.session?.track.at(-1);
    if (
      gpsQuality(nextLocation) === 'good' &&
      shouldRecordTrackPoint(lastPoint, nextLocation)
    ) {
      navigationState.appendTrackPoint({
        ...nextLocation.coordinates,
        accuracyMeters: nextLocation.accuracyMeters,
        timestamp: nextLocation.timestamp,
      });
      navigationState = useNavigationSessionStore.getState();
    }

    if (!navigationState.session) return;
    const metrics = calculateNavigationMetrics(
      nextLocation,
      navigationState.session,
    );
    const distanceMeters = metrics.distanceToWaypointNm * 1_852;
    const hasArrivalAccuracy =
      metrics.gpsQuality === 'good' &&
      nextLocation.accuracyMeters !== null &&
      nextLocation.accuracyMeters <= ARRIVAL_RADIUS_METERS;

    arrivalFixesRef.current =
      hasArrivalAccuracy && distanceMeters <= ARRIVAL_RADIUS_METERS
        ? arrivalFixesRef.current + 1
        : 0;

    if (arrivalFixesRef.current >= ARRIVAL_FIX_COUNT) {
      navigationState.markArrived();
    }
  };

  const startNavigation = async (target: NavigationTarget) => {
    const generation = ++requestGenerationRef.current;
    arrivalFixesRef.current = 0;
    setNowMs(Date.now());
    useNavigationSessionStore.getState().begin(target);
    const initialLocation = useLocationStore.getState().location;
    const nextLocation = await foregroundLocation.request();
    if (generation !== requestGenerationRef.current) return false;
    if (!nextLocation) {
      useNavigationSessionStore
        .getState()
        .fail(strings.navigationLocationUnavailable);
      return false;
    }
    // New fixes were already consumed by the subscription; cached fixes were not.
    if (nextLocation === initialLocation) handleLocation(nextLocation);
    const currentStatus = useNavigationSessionStore.getState().status;
    return (
      currentStatus === 'acquiring' ||
      currentStatus === 'navigating' ||
      currentStatus === 'arrived'
    );
  };

  useEffect(() => {
    if (status !== 'acquiring' && status !== 'navigating') return;

    const interval = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, [status]);

  const consumeLocation = useEffectEvent(handleLocation);
  useEffect(() => {
    const unsubscribe = useLocationStore.subscribe((state, previous) => {
      if (state.location !== previous.location) {
        if (state.location) consumeLocation(state.location);
        else arrivalFixesRef.current = 0;
      }
      const currentStatus = useNavigationSessionStore.getState().status;
      if (
        state.error &&
        state.error !== previous.error &&
        (currentStatus === 'acquiring' || currentStatus === 'navigating')
      ) {
        useNavigationSessionStore
          .getState()
          .fail(strings.navigationLocationUnavailable);
      }
    });
    return () => {
      requestGenerationRef.current += 1;
      unsubscribe();
    };
  }, []);

  const metrics =
    location && session && status === 'navigating'
      ? calculateNavigationMetrics(location, session, nowMs)
      : null;

  return {
    error,
    metrics,
    session,
    startNavigation,
    status,
    stopNavigation,
  };
}
