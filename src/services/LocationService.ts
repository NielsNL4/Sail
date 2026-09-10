import * as ExpoLocation from 'expo-location';

import type { LocationData, LocationPermissionStatus } from '@/types';

import {
  developmentLocationFromState,
  useDevelopmentLocationStore,
} from '../stores/developmentLocationStore';

export interface LocationResult {
  location: LocationData;
  permissionStatus: LocationPermissionStatus;
}

export interface LocationWatchResult {
  permissionStatus: LocationPermissionStatus;
  stop: () => void;
}

export class LocationPermissionError extends Error {
  constructor(public readonly permissionStatus: LocationPermissionStatus) {
    super('Location permission was not granted.');
  }
}

export interface LocationService {
  getCurrentLocation: () => Promise<LocationResult>;
  watchLocation: (
    onLocation: (location: LocationData) => void,
    onError: (error: Error) => void,
  ) => Promise<LocationWatchResult>;
}

const DEVELOPMENT_LOCATION: LocationData = {
  coordinates: {
    latitude: 52.75,
    longitude: 5.35,
  },
  accuracyMeters: null,
  altitudeMeters: null,
  headingDegrees: null,
  speedMetersPerSecond: null,
  timestamp: new Date(0).toISOString(),
  isMocked: true,
  source: 'development',
};

function normalizePermissionStatus(
  status: ExpoLocation.PermissionStatus,
): LocationPermissionStatus {
  if (status === ExpoLocation.PermissionStatus.GRANTED) {
    return 'granted';
  }

  if (status === ExpoLocation.PermissionStatus.DENIED) {
    return 'denied';
  }

  return 'undetermined';
}

function createDevelopmentResult(
  permissionStatus: LocationPermissionStatus,
): LocationResult {
  return {
    location: {
      ...DEVELOPMENT_LOCATION,
      timestamp: new Date().toISOString(),
    },
    permissionStatus,
  };
}

function normalizeLocation(
  position: ExpoLocation.LocationObject,
): LocationData {
  return {
    coordinates: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
    accuracyMeters: position.coords.accuracy,
    altitudeMeters: position.coords.altitude,
    headingDegrees: position.coords.heading,
    speedMetersPerSecond: position.coords.speed,
    timestamp: new Date(position.timestamp).toISOString(),
    isMocked: position.mocked ?? false,
    source: 'device',
  };
}

function normalizeWebLocation(position: GeolocationPosition): LocationData {
  return {
    coordinates: {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    },
    accuracyMeters: position.coords.accuracy,
    altitudeMeters: position.coords.altitude,
    headingDegrees: position.coords.heading,
    speedMetersPerSecond: position.coords.speed,
    timestamp: new Date(position.timestamp).toISOString(),
    isMocked: false,
    source: 'device',
  };
}

function developmentSimulationEnabled(): boolean {
  return (
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    useDevelopmentLocationStore.getState().enabled
  );
}

async function requestForegroundPermission(): Promise<{
  granted: boolean;
  permissionStatus: LocationPermissionStatus;
}> {
  const permission = await ExpoLocation.requestForegroundPermissionsAsync();
  return {
    granted: permission.granted,
    permissionStatus: normalizePermissionStatus(permission.status),
  };
}

export const locationService: LocationService = {
  async getCurrentLocation() {
    if (developmentSimulationEnabled()) {
      return {
        location: developmentLocationFromState(
          useDevelopmentLocationStore.getState(),
        ),
        permissionStatus: 'granted',
      };
    }

    let permissionStatus: LocationPermissionStatus = 'undetermined';

    try {
      const permission = await requestForegroundPermission();
      permissionStatus = permission.permissionStatus;
      if (!permission.granted) {
        throw new Error('Location permission was not granted.');
      }

      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
      });

      return {
        location: normalizeLocation(position),
        permissionStatus,
      };
    } catch (error) {
      if (__DEV__) {
        return createDevelopmentResult(permissionStatus);
      }

      throw error;
    }
  },
  async watchLocation(onLocation, onError) {
    if (developmentSimulationEnabled()) {
      let active = true;
      const emit = () => {
        if (!active) return;
        onLocation(
          developmentLocationFromState(useDevelopmentLocationStore.getState()),
        );
      };
      emit();
      const unsubscribe = useDevelopmentLocationStore.subscribe((state) => {
        if (!state.enabled) {
          active = false;
          unsubscribe();
          onError(new Error('Development location simulation was disabled.'));
          return;
        }
        emit();
      });

      return {
        permissionStatus: 'granted',
        stop: () => {
          active = false;
          unsubscribe();
        },
      };
    }

    const permission = await requestForegroundPermission();
    if (!permission.granted) {
      throw new LocationPermissionError(permission.permissionStatus);
    }
    if (
      typeof document !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => onLocation(normalizeWebLocation(position)),
        (error) => onError(new Error(error.message)),
        {
          enableHighAccuracy: true,
          maximumAge: 1_000,
          timeout: 15_000,
        },
      );

      return {
        permissionStatus: permission.permissionStatus,
        stop: () => navigator.geolocation.clearWatch(watchId),
      };
    }

    const subscription = await ExpoLocation.watchPositionAsync(
      {
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
        distanceInterval: 0,
        timeInterval: 1_000,
      },
      (position) => onLocation(normalizeLocation(position)),
      (reason) => onError(new Error(reason)),
    );

    return {
      permissionStatus: permission.permissionStatus,
      stop: () => subscription.remove(),
    };
  },
};
