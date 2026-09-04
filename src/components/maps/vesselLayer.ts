import type { AISVessel } from '@/types';

export const VESSEL_SOURCE_ID = 'ais-vessels-source';
export const VESSEL_HIT_LAYER_ID = 'ais-vessels-hit';
export const VESSEL_MARKER_LAYER_ID = 'ais-vessels-marker';

interface VesselProperties {
  mmsi: string;
  rotation: number;
}

export function vesselsToGeoJson(
  vessels: AISVessel[],
): GeoJSON.FeatureCollection<GeoJSON.Point, VesselProperties> {
  return {
    type: 'FeatureCollection',
    features: vessels.map((vessel) => ({
      type: 'Feature',
      id: vessel.mmsi,
      geometry: {
        type: 'Point',
        coordinates: [
          vessel.coordinates.longitude,
          vessel.coordinates.latitude,
        ],
      },
      properties: {
        mmsi: vessel.mmsi,
        rotation: vessel.headingDegrees ?? vessel.courseDegrees ?? 0,
      },
    })),
  };
}
