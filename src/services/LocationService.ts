import * as ExpoLocation from 'expo-location';

import type { LocationData, LocationPermissionStatus } from '@/types';

export interface LocationResult {
  location: LocationData;
  permissionStatus: LocationPermissionStatus;
}

export interface LocationService {
  getCurrentLocation: () => Promise<LocationResult>;
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

export const locationService: LocationService = {
  async getCurrentLocation() {
    let permissionStatus: LocationPermissionStatus = 'undetermined';

    try {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      permissionStatus = normalizePermissionStatus(permission.status);

      if (!permission.granted) {
        throw new Error('Location permission was not granted.');
      }

      const position = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.BestForNavigation,
      });

      return {
        location: {
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
        },
        permissionStatus,
      };
    } catch (error) {
      if (__DEV__) {
        return createDevelopmentResult(permissionStatus);
      }

      throw error;
    }
  },
};
