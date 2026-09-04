import type { FairwaySegment, NavigationMarker } from '@/types';

export const FAIRWAY_SOURCE_ID = 'rws-fairways-source';
export const FAIRWAY_LAYER_ID = 'rws-fairways-line';
export const FAIRWAY_HIT_LAYER_ID = 'rws-fairways-hit';
export const MARKER_SOURCE_ID = 'rws-navigation-markers-source';
export const MARKER_HIT_LAYER_ID = 'rws-navigation-markers-hit';
export const MARKER_SYMBOL_LAYER_ID = 'rws-navigation-markers-symbol';

export function fairwaysToGeoJson(
  fairways: FairwaySegment[],
): GeoJSON.FeatureCollection<
  GeoJSON.MultiLineString,
  { id: string; cemtClass: string }
> {
  return {
    type: 'FeatureCollection',
    features: fairways.map((fairway) => ({
      type: 'Feature',
      id: fairway.id,
      geometry: fairway.geometry,
      properties: { id: fairway.id, cemtClass: fairway.cemtClass },
    })),
  };
}

export function markersToGeoJson(
  markers: NavigationMarker[],
): GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { id: string; type: string; color: string }
> {
  return {
    type: 'FeatureCollection',
    features: markers.map((marker) => ({
      type: 'Feature',
      id: marker.id,
      geometry: {
        type: 'Point',
        coordinates: [marker.position.longitude, marker.position.latitude],
      },
      properties: {
        id: marker.id,
        type: marker.type,
        color: navigationMarkerColorKey(marker.color),
      },
    })),
  };
}

export function navigationMarkerColorKey(color: string | null): string {
  const normalized = color?.trim().toLowerCase() ?? '';
  if (normalized.includes('rood')) return 'red';
  if (normalized.includes('groen')) return 'green';
  if (normalized.includes('geel')) return 'yellow';
  if (normalized.includes('zwart')) return 'black';
  if (normalized.includes('wit')) return 'white';
  if (normalized.includes('oranje')) return 'orange';
  return 'unknown';
}

export function fairwayColor(cemtClass: string): string {
  if (cemtClass === 'unknown') return '#64748b';
  if (cemtClass === '0' || cemtClass === 'I') return '#94a3b8';
  if (cemtClass === 'II' || cemtClass === 'III') return '#38bdf8';
  if (cemtClass === 'IV' || cemtClass === 'V') return '#0284c7';
  return '#075985';
}
