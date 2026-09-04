import { useEffect } from 'react';

import { aisService } from '@/services';
import { useAISStore } from '@/stores';
import type { AISVessel, MapRegion } from '@/types';
import { regionToAISBoundingBox } from '@/utils';

const UPDATE_INTERVAL_MS = 1_000;
const VIEWPORT_DEBOUNCE_MS = 750;
const VESSEL_MAX_AGE_MS = 15 * 60 * 1_000;

export function useAIS(region: MapRegion, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      aisService.disconnect();
      useAISStore.getState().clear();
      return;
    }

    const pending = new Map<string, AISVessel>();
    const unsubscribeVessels = aisService.onVesselUpdate((vessel) => {
      pending.set(vessel.mmsi, vessel);
    });
    const unsubscribeStatus = aisService.onStatusChange((status, error) => {
      useAISStore.getState().setConnectionStatus(status, error);
    });
    const flushInterval = setInterval(() => {
      if (pending.size > 0) {
        useAISStore.getState().applyUpdates([...pending.values()]);
        pending.clear();
      }
      useAISStore.getState().expireBefore(Date.now() - VESSEL_MAX_AGE_MS);
    }, UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(flushInterval);
      unsubscribeVessels();
      unsubscribeStatus();
      aisService.disconnect();
      useAISStore.getState().clear();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = setTimeout(() => {
      aisService.connect(regionToAISBoundingBox(region));
    }, VIEWPORT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [enabled, region]);
}
