import { describe, expect, it } from 'vitest';

import {
  BATHYMETRY_TILE_URL,
  coordinatesToRegion,
  getMapStyleUrl,
  regionToZoom,
} from './mapboxConfig';

describe('regionToZoom', () => {
  it('converts a world-width region to zoom zero', () => {
    expect(
      regionToZoom({
        latitude: 0,
        longitude: 0,
        latitudeDelta: 180,
        longitudeDelta: 360,
      }),
    ).toBe(0);
  });

  it('increases zoom as the viewport narrows', () => {
    const wideZoom = regionToZoom({
      latitude: 52,
      longitude: 5,
      latitudeDelta: 4,
      longitudeDelta: 4,
    });
    const narrowZoom = regionToZoom({
      latitude: 52,
      longitude: 5,
      latitudeDelta: 1,
      longitudeDelta: 1,
    });

    expect(narrowZoom).toBeGreaterThan(wideZoom);
  });
});

describe('getMapStyleUrl', () => {
  it('resolves the modern nautical style', () => {
    expect(getMapStyleUrl('modern')).toMatch(/^mapbox:\/\/styles\//);
  });

  it('keeps satellite imagery as an optional style', () => {
    expect(getMapStyleUrl('satellite')).toContain('satellite-streets');
  });
});

describe('coordinatesToRegion', () => {
  it('creates a serializable region from Mapbox camera bounds', () => {
    expect(coordinatesToRegion([5, 52], [6, 53], [4, 51])).toEqual({
      latitude: 52,
      longitude: 5,
      latitudeDelta: 2,
      longitudeDelta: 2,
    });
  });
});

describe('Rijkswaterstaat bathymetry', () => {
  it('uses the official WMS layer with a Mapbox tile bounding box', () => {
    expect(BATHYMETRY_TILE_URL).toContain(
      'geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_20mtr',
    );
    expect(BATHYMETRY_TILE_URL).toContain('LAYERS=bodemhoogte_20mtr');
    expect(BATHYMETRY_TILE_URL).toContain('BBOX={bbox-epsg-3857}');
  });
});
