import { describe, expect, it } from 'vitest';

import { DEFAULT_MAP_ZOOM, DUTCH_WATERS_REGION } from '../../utils/constants';
import {
  COASTAL_BATHYMETRY_TILE_URL,
  INLAND_BATHYMETRY_TILE_URL,
  INLAND_ENC_TILE_URL,
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

  it('uses the marine overview zoom for a first launch', () => {
    expect(regionToZoom(DUTCH_WATERS_REGION)).toBe(DEFAULT_MAP_ZOOM);
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
    expect(COASTAL_BATHYMETRY_TILE_URL).toContain(
      'geo.rijkswaterstaat.nl/services/ogc/gdr/bodemhoogte_20mtr',
    );
    expect(COASTAL_BATHYMETRY_TILE_URL).toContain('LAYERS=bodemhoogte_20mtr');
    expect(COASTAL_BATHYMETRY_TILE_URL).toContain('BBOX={bbox-epsg-3857}');
  });

  it('uses the latest published 1 m inland snapshot', () => {
    expect(INLAND_BATHYMETRY_TILE_URL).toContain(
      'LAYERS=bodemhoogte_1mtr_202602',
    );
  });

  it('configures the official Inland ENC maritime WMS', () => {
    expect(INLAND_ENC_TILE_URL).toContain('/ENC/mcs_inland/');
    expect(INLAND_ENC_TILE_URL).toContain('LAYERS=2');
    expect(INLAND_ENC_TILE_URL).toContain('TRANSPARENT=TRUE');
    expect(INLAND_ENC_TILE_URL).toContain('BBOX={bbox-epsg-3857}');
  });

  it('requests blank images instead of XML WMS exceptions', () => {
    for (const url of [
      COASTAL_BATHYMETRY_TILE_URL,
      INLAND_BATHYMETRY_TILE_URL,
      INLAND_ENC_TILE_URL,
    ]) {
      expect(url).toContain('EXCEPTIONS=application/vnd.ogc.se_blank');
      expect(url).toContain('WIDTH=512&HEIGHT=512');
    }
  });
});
