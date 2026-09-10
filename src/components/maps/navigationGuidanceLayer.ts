import type { NavigationOverlay } from '@/types';
import {
  ARRIVAL_RADIUS_METERS,
  destinationCoordinates,
} from '../../utils/navigationCalculations';

export const NAVIGATION_GUIDANCE_SOURCE_ID = 'navigation-guidance-source';
export const NAVIGATION_ROUTE_LAYER_ID = 'navigation-route-line';
export const NAVIGATION_TRACK_LAYER_ID = 'navigation-track-line';
export const NAVIGATION_PROJECTION_LAYER_ID = 'navigation-projection-line';
export const NAVIGATION_ARRIVAL_LAYER_ID = 'navigation-arrival-area';
export const NAVIGATION_TARGET_LAYER_ID = 'navigation-target-marker';

type GuidanceKind = 'route' | 'track' | 'projection' | 'arrival' | 'target';

function longitudeNear(reference: number, longitude: number): number {
  let adjusted = longitude;
  while (adjusted - reference > 180) adjusted -= 360;
  while (adjusted - reference < -180) adjusted += 360;
  return adjusted;
}

function trackCoordinates(
  track: NavigationOverlay['track'],
): [number, number][] {
  let reference = track[0]?.longitude ?? 0;
  return track.map((point) => {
    const longitude = longitudeNear(reference, point.longitude);
    reference = longitude;
    return [longitude, point.latitude];
  });
}

export function navigationOverlayToGeoJson(
  overlay: NavigationOverlay | null,
): GeoJSON.FeatureCollection<GeoJSON.Geometry, { kind: GuidanceKind }> {
  if (!overlay) return { type: 'FeatureCollection', features: [] };

  const targetPosition = [
    overlay.targetCoordinates.longitude,
    overlay.targetCoordinates.latitude,
  ];
  const features: GeoJSON.Feature<GeoJSON.Geometry, { kind: GuidanceKind }>[] =
    [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: targetPosition,
        },
        properties: { kind: 'target' },
      },
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            Array.from({ length: 49 }, (_, index) => {
              const point = destinationCoordinates(
                overlay.targetCoordinates,
                (index % 48) * 7.5,
                ARRIVAL_RADIUS_METERS / 1_852,
              );
              return [
                longitudeNear(
                  overlay.targetCoordinates.longitude,
                  point.longitude,
                ),
                point.latitude,
              ];
            }),
          ],
        },
        properties: { kind: 'arrival' },
      },
    ];

  const routeStart =
    overlay.routeStartCoordinates ?? overlay.currentCoordinates;
  if (routeStart) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [routeStart.longitude, routeStart.latitude],
          [
            longitudeNear(
              routeStart.longitude,
              overlay.targetCoordinates.longitude,
            ),
            overlay.targetCoordinates.latitude,
          ],
        ],
      },
      properties: { kind: 'route' },
    });
  }

  if (overlay.track.length > 1) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: trackCoordinates(overlay.track),
      },
      properties: { kind: 'track' },
    });
  }

  if (overlay.currentCoordinates && overlay.projectedCoordinates) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [
            overlay.currentCoordinates.longitude,
            overlay.currentCoordinates.latitude,
          ],
          [
            longitudeNear(
              overlay.currentCoordinates.longitude,
              overlay.projectedCoordinates.longitude,
            ),
            overlay.projectedCoordinates.latitude,
          ],
        ],
      },
      properties: { kind: 'projection' },
    });
  }

  return { type: 'FeatureCollection', features };
}
