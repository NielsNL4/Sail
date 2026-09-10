import * as ExpoLocation from 'expo-location';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDevelopmentLocationStore } from '../stores/developmentLocationStore';
import { useLocationStore } from '../stores/locationStore';
import { createForegroundLocationOwner } from './foregroundLocation';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));
vi.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  requestForegroundPermissionsAsync: vi.fn(),
  watchPositionAsync: vi.fn(),
}));

const position = (): ExpoLocation.LocationObject => ({
  coords: {
    latitude: 52,
    longitude: 5,
    accuracy: 5,
    altitude: null,
    altitudeAccuracy: null,
    heading: 90,
    speed: 2,
  },
  timestamp: Date.now(),
});
let cleanup: () => void;
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('__DEV__', true);
  useDevelopmentLocationStore.getState().setEnabled(false);
  useLocationStore.getState().clearLocation();
  vi.mocked(ExpoLocation.requestForegroundPermissionsAsync).mockResolvedValue({
    granted: true,
    status: ExpoLocation.PermissionStatus.GRANTED,
    expires: 'never',
    canAskAgain: true,
  });
});
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('shares requests and retains continuous fixes until App cleanup', async () => {
  let emit!: ExpoLocation.LocationCallback;
  const remove = vi.fn();
  vi.mocked(ExpoLocation.watchPositionAsync).mockImplementation(
    async (_options, callback) => {
      emit = callback;
      return { remove };
    },
  );
  const owner = createForegroundLocationOwner();
  cleanup = owner.mount();
  expect(ExpoLocation.watchPositionAsync).not.toHaveBeenCalled();
  const first = owner.request();
  expect(owner.request()).toBe(first);
  await vi.waitFor(() => expect(emit).toBeDefined());
  emit(position());
  await first;
  await owner.request();
  emit({ ...position(), coords: { ...position().coords, latitude: 53 } });
  expect(useLocationStore.getState().location?.coordinates.latitude).toBe(53);
  expect(ExpoLocation.watchPositionAsync).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
  cleanup();
  expect(remove).toHaveBeenCalledOnce();
});

it('removes a late registration before resuming device GPS and ignores its callbacks', async () => {
  let resolve!: (subscription: ExpoLocation.LocationSubscription) => void;
  let emit!: ExpoLocation.LocationCallback;
  const remove = vi.fn();
  vi.mocked(ExpoLocation.watchPositionAsync)
    .mockImplementationOnce((_options, callback) => {
      emit = callback;
      return new Promise((done) => {
        resolve = done;
      });
    })
    .mockResolvedValue({ remove: vi.fn() });
  const owner = createForegroundLocationOwner();
  cleanup = owner.mount();
  const request = owner.request();
  await vi.waitFor(() => expect(resolve).toBeDefined());
  useDevelopmentLocationStore.getState().setEnabled(true);
  await request;
  emit(position());
  expect(useLocationStore.getState().location?.source).toBe('development');
  useDevelopmentLocationStore.getState().setEnabled(false);
  expect(useLocationStore.getState().location).toBeNull();
  expect(ExpoLocation.watchPositionAsync).toHaveBeenCalledOnce();
  resolve({ remove });
  await vi.waitFor(() =>
    expect(ExpoLocation.watchPositionAsync).toHaveBeenCalledTimes(2),
  );
  expect(remove).toHaveBeenCalledOnce();
  emit(position());
  expect(useLocationStore.getState().location).toBeNull();
});

it('does not refresh a paused simulator when location is requested', async () => {
  vi.useFakeTimers();
  useDevelopmentLocationStore.getState().setEnabled(true);
  const owner = createForegroundLocationOwner();
  cleanup = owner.mount();
  const fix = useLocationStore.getState().location;
  vi.advanceTimersByTime(60_000);
  useDevelopmentLocationStore.getState().pause();
  expect(await owner.request()).toBe(fix);
  expect(Date.now() - Date.parse(fix!.timestamp)).toBe(60_000);
  expect(ExpoLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
});

it('settles failed requests and permits a retry without a one-shot fix', async () => {
  vi.mocked(
    ExpoLocation.requestForegroundPermissionsAsync,
  ).mockResolvedValueOnce({
    granted: false,
    status: ExpoLocation.PermissionStatus.DENIED,
    expires: 'never',
    canAskAgain: false,
  });
  vi.mocked(ExpoLocation.watchPositionAsync).mockImplementation(
    async (_options, callback) => {
      callback(position());
      return { remove: vi.fn() };
    },
  );
  const owner = createForegroundLocationOwner();
  cleanup = owner.mount();
  expect(await owner.request()).toBeNull();
  expect(useLocationStore.getState().isLocating).toBe(false);
  expect(useLocationStore.getState().permissionStatus).toBe('denied');
  expect(await owner.request()).not.toBeNull();
  expect(useLocationStore.getState().error).toBeNull();
});

it('cancels pending consumers on unmount and removes a late subscription', async () => {
  let resolve!: (subscription: ExpoLocation.LocationSubscription) => void;
  let emit!: ExpoLocation.LocationCallback;
  const remove = vi.fn();
  vi.mocked(ExpoLocation.watchPositionAsync).mockImplementation(
    (_options, callback) => {
      emit = callback;
      return new Promise((done) => {
        resolve = done;
      });
    },
  );
  const owner = createForegroundLocationOwner();
  cleanup = owner.mount();
  const request = owner.request();
  await vi.waitFor(() => expect(resolve).toBeDefined());
  cleanup();
  expect(await request).toBeNull();
  emit(position());
  expect(useLocationStore.getState().location).toBeNull();
  resolve({ remove });
  await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce());
});
