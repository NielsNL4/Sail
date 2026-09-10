import type { Coordinates, SailingOverlay } from '@/types';

export const SAILING_GUIDANCE_SOURCE_ID = 'sailing-guidance-source';
export const SAILING_NO_GO_LAYER_ID = 'sailing-no-go-area';
export const SAILING_PORT_LAYER_ID = 'sailing-port-layline';
export const SAILING_STARBOARD_LAYER_ID = 'sailing-starboard-layline';
export const SAILING_TACK_POINT_LAYER_ID = 'sailing-tack-point';

type SailingFeatureKind = 'no-go' | 'port' | 'starboard' | 'tack-point';

function unwrapCoordinates(points: Coordinates[]): [number, number][] {
  let reference = points[0]?.longitude ?? 0;
  return points.map((point) => {
    let longitude = point.longitude;
    while (longitude - reference > 180) longitude -= 360;
    while (longitude - reference < -180) longitude += 360;
    reference = longitude;
    return [longitude, point.latitude];
  });
}

export function sailingOverlayToGeoJson(
  overlay: SailingOverlay | null,
): GeoJSON.FeatureCollection<GeoJSON.Geometry, { kind: SailingFeatureKind }> {
  if (!overlay) return { type: 'FeatureCollection', features: [] };

  const features: GeoJSON.Feature<
    GeoJSON.Geometry,
    { kind: SailingFeatureKind }
  >[] = [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [unwrapCoordinates(overlay.noGoZone)],
      },
      properties: { kind: 'no-go' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: unwrapCoordinates(overlay.portLayline),
      },
      properties: { kind: 'port' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: unwrapCoordinates(overlay.starboardLayline),
      },
      properties: { kind: 'starboard' },
    },
  ];

  if (overlay.recommendedTackPoint) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [
          overlay.recommendedTackPoint.longitude,
          overlay.recommendedTackPoint.latitude,
        ],
      },
      properties: { kind: 'tack-point' },
    });
  }

  return { type: 'FeatureCollection', features };
}
