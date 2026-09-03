import type { MapRegion, MapStyleId } from '@/types';

const MAPBOX_STYLE_URLS: Record<MapStyleId, string> = {
  modern:
    process.env.EXPO_PUBLIC_MAPBOX_STYLE_MODERN ??
    'mapbox://styles/mapbox/navigation-day-v1',
  traditional:
    process.env.EXPO_PUBLIC_MAPBOX_STYLE_TRADITIONAL ??
    'mapbox://styles/mapbox/outdoors-v12',
  dark:
    process.env.EXPO_PUBLIC_MAPBOX_STYLE_DARK ??
    'mapbox://styles/mapbox/navigation-night-v1',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};
export const DEPTH_SOURCE_ID = 'sail-depth-source';
export const DEPTH_RASTER_LAYER_ID = 'sail-depth-raster';
export const WIND_SOURCE_ID = 'sail-wind-source';
export const WIND_PARTICLE_LAYER_IDS = [0, 1, 2, 3].map(
  (bucket) => `sail-wind-particles-${bucket}`,
);
export const BATHYMETRY_ATTRIBUTION = 'Rijkswaterstaat bathymetrie (CC0)';
export const BATHYMETRY_BOUNDS = [2.53, 50.67, 7.28, 55.77];
export const BATHYMETRY_TILE_URL =
  'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_20mtr/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=bodemhoogte_20mtr&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}';

export function getMapStyleUrl(style: MapStyleId): string {
  return MAPBOX_STYLE_URLS[style];
}

export function regionToZoom(region: MapRegion): number {
  const longitudeDelta = Math.max(region.longitudeDelta, 0.000_001);

  return Math.log2(360 / longitudeDelta);
}

export function coordinatesToRegion(
  center: GeoJSON.Position,
  northEast: GeoJSON.Position,
  southWest: GeoJSON.Position,
): MapRegion {
  return {
    latitude: center[1],
    longitude: center[0],
    latitudeDelta: Math.abs(northEast[1] - southWest[1]),
    longitudeDelta: Math.abs(northEast[0] - southWest[0]),
  };
}
