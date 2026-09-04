import type { DepthMode } from '@/types';

import {
  BRIDGE_HIT_LAYER_ID,
  BRIDGE_SYMBOL_LAYER_ID,
  FAIRWAY_HIT_LAYER_ID,
  FAIRWAY_LAYER_ID,
  MARKER_HIT_LAYER_ID,
  MARKER_SYMBOL_LAYER_ID,
} from './navigationLayer';
import {
  COASTAL_DEPTH_LAYER_ID,
  ENC_LAYER_ID,
  INLAND_DEPTH_LAYER_ID,
  WIND_PARTICLE_LAYER_IDS,
} from './mapboxConfig';
import { VESSEL_HIT_LAYER_ID, VESSEL_MARKER_LAYER_ID } from './vesselLayer';

interface OverlayVisibility {
  depthMode: DepthMode;
  depthVisible: boolean;
  windVisible: boolean;
  vesselsVisible: boolean;
  fairwaysVisible: boolean;
  markersVisible: boolean;
  bridgesVisible: boolean;
}

export function getOverlayLayerVisibility({
  depthMode,
  depthVisible,
  windVisible,
  vesselsVisible,
  fairwaysVisible,
  markersVisible,
  bridgesVisible,
}: OverlayVisibility): Record<string, 'visible' | 'none'> {
  const visibility: Record<string, 'visible' | 'none'> = {
    [COASTAL_DEPTH_LAYER_ID]:
      depthVisible && depthMode === 'bathymetry' ? 'visible' : 'none',
    [INLAND_DEPTH_LAYER_ID]:
      depthVisible && depthMode === 'bathymetry' ? 'visible' : 'none',
    [ENC_LAYER_ID]: depthVisible && depthMode === 'enc' ? 'visible' : 'none',
    [VESSEL_HIT_LAYER_ID]: vesselsVisible ? 'visible' : 'none',
    [VESSEL_MARKER_LAYER_ID]: vesselsVisible ? 'visible' : 'none',
    [FAIRWAY_HIT_LAYER_ID]: fairwaysVisible ? 'visible' : 'none',
    [FAIRWAY_LAYER_ID]: fairwaysVisible ? 'visible' : 'none',
    [MARKER_HIT_LAYER_ID]: markersVisible ? 'visible' : 'none',
    [MARKER_SYMBOL_LAYER_ID]: markersVisible ? 'visible' : 'none',
    [BRIDGE_HIT_LAYER_ID]: bridgesVisible ? 'visible' : 'none',
    [BRIDGE_SYMBOL_LAYER_ID]: bridgesVisible ? 'visible' : 'none',
  };

  for (const layerId of WIND_PARTICLE_LAYER_IDS) {
    visibility[layerId] = windVisible ? 'visible' : 'none';
  }

  return visibility;
}
