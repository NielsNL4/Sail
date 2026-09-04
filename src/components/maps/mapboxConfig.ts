import type { MapRegion, MapStyleId } from '@/types';

import { DEPTH_DETAIL_ZOOM } from '../../utils/constants';

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
export const COASTAL_DEPTH_SOURCE_ID = 'sail-coastal-depth-source';
export const COASTAL_DEPTH_LAYER_ID = 'sail-coastal-depth-raster';
export const INLAND_DEPTH_SOURCE_ID = 'sail-inland-depth-source';
export const INLAND_DEPTH_LAYER_ID = 'sail-inland-depth-raster';
export const ENC_SOURCE_ID = 'sail-inland-enc-source';
export const ENC_LAYER_ID = 'sail-inland-enc-raster';
export const MIN_DEPTH_RASTER_ZOOM = 8;
export const MIN_INLAND_DEPTH_RASTER_ZOOM = DEPTH_DETAIL_ZOOM;
export const WIND_SOURCE_ID = 'sail-wind-source';
export const WIND_PARTICLE_LAYER_IDS = [0, 1, 2, 3].map(
  (bucket) => `sail-wind-particles-${bucket}`,
);
export const BATHYMETRY_ATTRIBUTION =
  'Rijkswaterstaat bathymetrie en Inland ENC (CC0)';
export const BATHYMETRY_BOUNDS: [number, number, number, number] = [
  2.53, 50.67, 7.28, 55.77,
];
export const INLAND_ENC_BOUNDS: [number, number, number, number] = [
  3.133333, 50.757502, 7.216667, 53.6,
];
export const COASTAL_BATHYMETRY_TILE_URL =
  'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_20mtr/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=bodemhoogte_20mtr&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&EXCEPTIONS=application/vnd.ogc.se_blank&CRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX={bbox-epsg-3857}';
export const INLAND_BATHYMETRY_TILE_URL =
  'https://geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_1mtr_historie/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=bodemhoogte_1mtr_202602&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&EXCEPTIONS=application/vnd.ogc.se_blank&CRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX={bbox-epsg-3857}';
export const INLAND_ENC_TILE_URL =
  'https://geo.rijkswaterstaat.nl/arcgis/rest/services/ENC/mcs_inland/MapServer/exts/MaritimeChartService/WMSServer?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=2&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&EXCEPTIONS=application/vnd.ogc.se_blank&CRS=EPSG:3857&WIDTH=512&HEIGHT=512&BBOX={bbox-epsg-3857}';

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
