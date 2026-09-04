import type { MapRegion } from '@/types';

export const DEFAULT_MAP_ZOOM = 13;
const configuredMarkerZoom = Number(process.env.EXPO_PUBLIC_MIN_MARKER_ZOOM);
export const MIN_MARKER_ZOOM = Number.isFinite(configuredMarkerZoom)
  ? configuredMarkerZoom
  : 11;
export const DEPTH_DETAIL_ZOOM = 12;

export const DUTCH_WATERS_REGION: MapRegion = {
  latitude: 52.65,
  longitude: 5.25,
  latitudeDelta: 0.034,
  longitudeDelta: 360 / 2 ** DEFAULT_MAP_ZOOM,
};
