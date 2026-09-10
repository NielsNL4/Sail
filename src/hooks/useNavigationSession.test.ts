import * as ExpoLocation from 'expo-location';
import { afterEach, expect, it, vi } from 'vitest';
import { foregroundLocation } from '../services/foregroundLocation';
import { useLocationStore } from '../stores/locationStore';
import { useNavigationSessionStore } from '../stores/navigationSessionStore';
import { useNavigationSession } from './useNavigationSession';

// Exercise the controller's subscription without adding a native renderer.
const { cleanups } = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));
vi.mock('react', async (importOriginal) => {
  const mocked = {
    ...(await importOriginal<typeof import('react')>()),
    useEffect: (effect: () => void | (() => void)) => {
      const cleanup = effect();
      if (cleanup) cleanups.push(cleanup);
    },
    useEffectEvent: (callback: unknown) => callback,
    useRef: (current: unknown) => ({ current }),
    useState: (initial: unknown) => [
      typeof initial === 'function' ? initial() : initial,
      vi.fn(),
    ],
  };
  return { ...mocked, default: mocked };
});
vi.mock('../stores/locationStore', async (importOriginal) => {
  const { useLocationStore: store } =
    await importOriginal<typeof import('../stores/locationStore')>();
  return {
    useLocationStore: Object.assign(
      (selector: (state: ReturnType<typeof store.getState>) => unknown) =>
        selector(store.getState()),
      store,
    ),
  };
});
vi.mock('../stores/navigationSessionStore', async (importOriginal) => {
  const { useNavigationSessionStore: store } =
    await importOriginal<typeof import('../stores/navigationSessionStore')>();
  return {
    useNavigationSessionStore: Object.assign(
      (selector: (state: ReturnType<typeof store.getState>) => unknown) =>
        selector(store.getState()),
      store,
    ),
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
  },
}));
vi.mock('expo-location', () => ({
  Accuracy: { BestForNavigation: 6 },
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied' },
  requestForegroundPermissionsAsync: vi.fn(async () => ({
    granted: true,
    status: 'granted',
  })),
  watchPositionAsync: vi.fn(),
}));
afterEach(() => {
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup());
  useNavigationSessionStore.getState().stop();
  vi.unstubAllGlobals();
});

it('navigation shares the app watch and stop/arrival leave device fixes flowing', async () => {
  vi.stubGlobal('__DEV__', false);
  let emit!: ExpoLocation.LocationCallback;
  const remove = vi.fn();
  vi.mocked(ExpoLocation.watchPositionAsync).mockImplementation(
    async (_options, callback) => {
      emit = callback;
      return { remove };
    },
  );
  cleanups.push(foregroundLocation.mount());
  const navigation = useNavigationSession();
  const request = foregroundLocation.request();
  await vi.waitFor(() => expect(emit).toBeDefined());
  const fix = (latitude: number) =>
    emit({
      coords: {
        latitude,
        longitude: 5,
        accuracy: 5,
        altitude: null,
        altitudeAccuracy: null,
        heading: 0,
        speed: 2,
      },
      timestamp: Date.now(),
    });
  fix(52);
  await request;
  const target = {
    id: 'test',
    name: 'Target',
    coordinates: { latitude: 53, longitude: 5 },
  };
  await navigation.startNavigation(target);
  expect(useNavigationSessionStore.getState().status).toBe('navigating');
  navigation.stopNavigation();
  fix(52.1);
  expect(useLocationStore.getState().location?.coordinates.latitude).toBe(52.1);
  expect(useNavigationSessionStore.getState().session).toBeNull();
  await navigation.startNavigation(target);
  fix(53);
  fix(53);
  fix(53);
  expect(useNavigationSessionStore.getState().status).toBe('arrived');
  const track = useNavigationSessionStore.getState().session?.track;
  fix(53.1);
  expect(useLocationStore.getState().location?.coordinates.latitude).toBe(53.1);
  expect(useNavigationSessionStore.getState().session?.track).toBe(track);
  expect(ExpoLocation.watchPositionAsync).toHaveBeenCalledOnce();
  expect(remove).not.toHaveBeenCalled();
});
