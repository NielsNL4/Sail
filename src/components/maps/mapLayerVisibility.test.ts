import { describe, expect, it } from 'vitest';

import {
  COASTAL_DEPTH_LAYER_ID,
  ENC_LAYER_ID,
  WIND_PARTICLE_LAYER_IDS,
} from './mapboxConfig';
import { getOverlayLayerVisibility } from './mapLayerVisibility';
import { VESSEL_MARKER_LAYER_ID } from './vesselLayer';

const defaults = {
  depthMode: 'enc' as const,
  depthVisible: false,
  windVisible: false,
  vesselsVisible: false,
  fairwaysVisible: false,
  markersVisible: false,
  bridgesVisible: false,
};

describe('getOverlayLayerVisibility', () => {
  it('updates regular and wind layers directly from menu state', () => {
    const visibility = getOverlayLayerVisibility({
      ...defaults,
      vesselsVisible: true,
      windVisible: true,
    });

    expect(visibility[VESSEL_MARKER_LAYER_ID]).toBe('visible');
    expect(visibility[WIND_PARTICLE_LAYER_IDS[0]]).toBe('visible');
  });

  it('shows only the selected depth mode', () => {
    const enc = getOverlayLayerVisibility({
      ...defaults,
      depthVisible: true,
    });
    const bathymetry = getOverlayLayerVisibility({
      ...defaults,
      depthMode: 'bathymetry',
      depthVisible: true,
    });

    expect(enc[ENC_LAYER_ID]).toBe('visible');
    expect(enc[COASTAL_DEPTH_LAYER_ID]).toBe('none');
    expect(bathymetry[ENC_LAYER_ID]).toBe('none');
    expect(bathymetry[COASTAL_DEPTH_LAYER_ID]).toBe('visible');
  });
});
