import * as ExpoLocation from 'expo-location';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_DEVELOPMENT_LOCATION,
  useDevelopmentLocationStore,
} from '../stores/developmentLocationStore';

import { locationService } from './LocationService';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  watchPositionAsync: vi.fn(),
}));

const runtime = globalThis as typeof globalThis & { __DEV__: boolean };
const requestPermission = vi.mocked(
  ExpoLocation.requestForegroundPermissionsAsync,
);
const getCurrentPosition = vi.mocked(ExpoLocation.getCurrentPositionAsync);
const watchPosition = vi.mocked(ExpoLocation.watchPositionAsync);

describe('locationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.__DEV__ = true;
    useDevelopmentLocationStore.setState({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: false,
      running: false,
      lastAdvancedAtMs: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes a real Expo location', async () => {
    requestPermission.mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: true,
      status: ExpoLocation.PermissionStatus.GRANTED,
    });
    getCurrentPosition.mockResolvedValue({
      coords: {
        accuracy: 5,
        altitude: 2,
        altitudeAccuracy: 3,
        heading: 180,
        latitude: 52.5,
        longitude: 5.5,
        speed: 4,
      },
      mocked: false,
      timestamp: 1_700_000_000_000,
    });

    const result = await locationService.getCurrentLocation();

    expect(result.permissionStatus).toBe('granted');
    expect(result.location.coordinates).toEqual({
      latitude: 52.5,
      longitude: 5.5,
    });
    expect(result.location.isMocked).toBe(false);
    expect(result.location.source).toBe('device');
  });

  it('uses the IJsselmeer fallback when permission is denied in development', async () => {
    requestPermission.mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: false,
      status: ExpoLocation.PermissionStatus.DENIED,
    });

    const result = await locationService.getCurrentLocation();

    expect(result.permissionStatus).toBe('denied');
    expect(result.location.coordinates).toEqual({
      latitude: 52.75,
      longitude: 5.35,
    });
    expect(result.location.isMocked).toBe(true);
    expect(result.location.source).toBe('development');
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('does not spoof a denied location in production', async () => {
    runtime.__DEV__ = false;
    requestPermission.mockResolvedValue({
      canAskAgain: false,
      expires: 'never',
      granted: false,
      status: ExpoLocation.PermissionStatus.DENIED,
    });

    await expect(locationService.getCurrentLocation()).rejects.toThrow(
      'Location permission was not granted.',
    );
  });

  it('ignores an enabled simulator in production', async () => {
    runtime.__DEV__ = false;
    useDevelopmentLocationStore.setState({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: true,
      running: false,
      lastAdvancedAtMs: null,
    });
    requestPermission.mockResolvedValue({
      canAskAgain: false,
      expires: 'never',
      granted: false,
      status: ExpoLocation.PermissionStatus.DENIED,
    });

    await expect(locationService.getCurrentLocation()).rejects.toThrow(
      'Location permission was not granted.',
    );
  });

  it('normalizes watched locations and stops the subscription', async () => {
    requestPermission.mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: true,
      status: ExpoLocation.PermissionStatus.GRANTED,
    });
    const remove = vi.fn();
    watchPosition.mockImplementation(async (_options, callback) => {
      callback({
        coords: {
          accuracy: 4,
          altitude: 1,
          altitudeAccuracy: 2,
          heading: 92,
          latitude: 52.7,
          longitude: 5.3,
          speed: 3,
        },
        mocked: false,
        timestamp: 1_700_000_000_000,
      });
      return { remove };
    });
    const onLocation = vi.fn();

    const watch = await locationService.watchLocation(onLocation, vi.fn());
    watch.stop();

    expect(watch.permissionStatus).toBe('granted');
    expect(onLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        coordinates: { latitude: 52.7, longitude: 5.3 },
        headingDegrees: 92,
        speedMetersPerSecond: 3,
      }),
    );
    expect(remove).toHaveBeenCalledOnce();
  });

  it('does not start watching when permission is denied in development', async () => {
    requestPermission.mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: false,
      status: ExpoLocation.PermissionStatus.DENIED,
    });

    await expect(
      locationService.watchLocation(vi.fn(), vi.fn()),
    ).rejects.toThrow('Location permission was not granted.');
    expect(watchPosition).not.toHaveBeenCalled();
  });

  it('bypasses device permissions and streams the development simulator', async () => {
    useDevelopmentLocationStore.setState({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: true,
      running: false,
      lastAdvancedAtMs: null,
    });
    const onLocation = vi.fn();

    const current = await locationService.getCurrentLocation();
    const watch = await locationService.watchLocation(onLocation, vi.fn());
    useDevelopmentLocationStore.getState().setConfiguration({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      coordinates: { latitude: 53, longitude: 5 },
    });
    watch.stop();

    expect(current.location.source).toBe('development');
    expect(current.permissionStatus).toBe('granted');
    expect(onLocation).toHaveBeenCalledTimes(2);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('ends a simulated watcher when simulation is disabled', async () => {
    useDevelopmentLocationStore.setState({
      ...DEFAULT_DEVELOPMENT_LOCATION,
      enabled: true,
      running: false,
      lastAdvancedAtMs: null,
    });
    const onError = vi.fn();
    await locationService.watchLocation(vi.fn(), onError);

    useDevelopmentLocationStore.getState().setEnabled(false);

    expect(onError).toHaveBeenCalledOnce();
  });

  it('uses the browser geolocation watcher with high accuracy on web', async () => {
    requestPermission.mockResolvedValue({
      canAskAgain: true,
      expires: 'never',
      granted: true,
      status: ExpoLocation.PermissionStatus.GRANTED,
    });
    const clearWatch = vi.fn();
    const browserWatch = vi.fn(
      (
        success: PositionCallback,
        _error: PositionErrorCallback,
        options: PositionOptions,
      ) => {
        expect(options.enableHighAccuracy).toBe(true);
        success({
          coords: {
            accuracy: 6,
            altitude: null,
            altitudeAccuracy: null,
            heading: 45,
            latitude: 52.75,
            longitude: 5.35,
            speed: 2,
            toJSON: () => ({}),
          },
          timestamp: 1_700_000_000_000,
          toJSON: () => ({}),
        });
        return 7;
      },
    );
    vi.stubGlobal('document', {});
    vi.stubGlobal('navigator', {
      geolocation: { clearWatch, watchPosition: browserWatch },
    });
    const onLocation = vi.fn();

    const watch = await locationService.watchLocation(onLocation, vi.fn());
    watch.stop();

    expect(onLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        coordinates: { latitude: 52.75, longitude: 5.35 },
      }),
    );
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(watchPosition).not.toHaveBeenCalled();
  });
});
