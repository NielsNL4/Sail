import * as ExpoLocation from 'expo-location';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { locationService } from './LocationService';

vi.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  PermissionStatus: {
    DENIED: 'denied',
    GRANTED: 'granted',
    UNDETERMINED: 'undetermined',
  },
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

const runtime = globalThis as typeof globalThis & { __DEV__: boolean };
const requestPermission = vi.mocked(
  ExpoLocation.requestForegroundPermissionsAsync,
);
const getCurrentPosition = vi.mocked(ExpoLocation.getCurrentPositionAsync);

describe('locationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runtime.__DEV__ = true;
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
});
