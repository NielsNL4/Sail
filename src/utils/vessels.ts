import type { AISBoundingBox, MapRegion } from '@/types';

export function regionToAISBoundingBox(region: MapRegion): AISBoundingBox {
  const halfLatitude = region.latitudeDelta / 2;
  const halfLongitude = region.longitudeDelta / 2;

  return {
    southWest: {
      latitude: Math.max(-90, region.latitude - halfLatitude),
      longitude: Math.max(-180, region.longitude - halfLongitude),
    },
    northEast: {
      latitude: Math.min(90, region.latitude + halfLatitude),
      longitude: Math.min(180, region.longitude + halfLongitude),
    },
  };
}

export function shipTypeLabel(shipType: number | null): string | null {
  if (shipType === null) {
    return null;
  }
  if (shipType === 36) return 'Zeilschip';
  if (shipType === 37) return 'Pleziervaartuig';
  if (shipType >= 30 && shipType <= 35) return 'Werkschip';
  if (shipType >= 40 && shipType <= 49) return 'Hogesnelheidsschip';
  if (shipType === 50) return 'Loodsvaartuig';
  if (shipType === 52) return 'Sleepboot';
  if (shipType >= 60 && shipType <= 69) return 'Passagiersschip';
  if (shipType >= 70 && shipType <= 79) return 'Vrachtschip';
  if (shipType >= 80 && shipType <= 89) return 'Tanker';
  return `AIS-type ${shipType}`;
}
