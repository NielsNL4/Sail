import { strings } from '../i18n';
import {
  developmentLocationFromState,
  useDevelopmentLocationStore,
} from '../stores/developmentLocationStore';
import { useLocationStore } from '../stores/locationStore';
import type { LocationData } from '../types';
import { LocationPermissionError, locationService } from './LocationService';

// One App-lifetime owner. Screens and navigation only request/consume its fixes.
export function createForegroundLocationOwner() {
  let mounted = false;
  let requested = false;
  let generation = 0;
  let stop: (() => void) | null = null;
  let starting = Promise.resolve();
  let pending: Promise<LocationData | null> | null = null;
  let finish: ((location: LocationData | null) => void) | null = null;
  const simulated = () =>
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    useDevelopmentLocationStore.getState().enabled;

  const publish = (location: LocationData) => {
    useLocationStore.getState().setLocation(location);
    useLocationStore.getState().setLocating(false);
    finish?.(location);
  };

  const switchSource = () => {
    const current = ++generation;
    stop?.();
    stop = null;
    useLocationStore.getState().clearLocation();
    if (!mounted) return;
    if (simulated()) {
      publish(
        developmentLocationFromState(useDevelopmentLocationStore.getState()),
      );
      return;
    }
    if (!requested) return;
    useLocationStore.getState().setLocating(true);
    // Serialize asynchronous registration, including removal of late subscriptions.
    starting = starting.then(async () => {
      if (!mounted || current !== generation) return;
      try {
        const watch = await locationService.watchLocation(
          (location) => {
            if (mounted && current === generation && !simulated())
              publish(location);
          },
          () => {
            if (mounted && current === generation && !simulated()) {
              useLocationStore.getState().setError(strings.locationUnavailable);
              finish?.(null);
            }
          },
        );
        if (!mounted || current !== generation) {
          watch.stop();
          return;
        }
        stop = watch.stop;
        useLocationStore.getState().setPermissionStatus(watch.permissionStatus);
      } catch (error) {
        if (mounted && current === generation) {
          if (error instanceof LocationPermissionError) {
            useLocationStore
              .getState()
              .setPermissionStatus(error.permissionStatus);
          }
          useLocationStore.getState().setError(strings.locationUnavailable);
          finish?.(null);
        }
      }
    });
  };

  return {
    mount() {
      mounted = true;
      switchSource();
      const unsubscribe = useDevelopmentLocationStore.subscribe(
        (state, previous) => {
          if (typeof __DEV__ === 'undefined' || !__DEV__) return;
          if (state.enabled !== previous.enabled) {
            switchSource();
          } else if (
            state.enabled &&
            (state.coordinates !== previous.coordinates ||
              state.courseDegrees !== previous.courseDegrees ||
              state.speedKnots !== previous.speedKnots ||
              state.accuracyMeters !== previous.accuracyMeters ||
              (state.running &&
                state.lastAdvancedAtMs !== previous.lastAdvancedAtMs))
          ) {
            publish(developmentLocationFromState(state));
          }
        },
      );
      return () => {
        mounted = false;
        requested = false;
        generation += 1;
        unsubscribe();
        stop?.();
        stop = null;
        finish?.(null);
        useLocationStore.getState().setLocating(false);
      };
    },
    request(): Promise<LocationData | null> {
      if (!mounted) return Promise.resolve(null);
      requested = true;
      if (pending) return pending;
      const state = useLocationStore.getState();
      if (
        simulated() ||
        (stop &&
          !state.error &&
          state.location &&
          Date.now() - Date.parse(state.location.timestamp) < 15_000)
      ) {
        return Promise.resolve(state.location);
      }
      pending = new Promise((resolve) => {
        const timeout = setTimeout(() => {
          useLocationStore.getState().setError(strings.locationUnavailable);
          finish?.(null);
        }, 15_000);
        finish = (location) => {
          clearTimeout(timeout);
          finish = null;
          pending = null;
          resolve(location);
        };
      });
      const result = pending;
      if (!stop || state.error) switchSource();
      else state.setLocating(true);
      return result;
    },
  };
}

export const foregroundLocation = createForegroundLocationOwner();
