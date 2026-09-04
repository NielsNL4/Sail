import { create } from 'zustand';

import type { AISConnectionStatus, AISVessel } from '@/types';

interface AISState {
  vessels: Record<string, AISVessel>;
  connectionStatus: AISConnectionStatus;
  error: string | null;
  applyUpdates: (vessels: AISVessel[]) => void;
  expireBefore: (cutoffTimestamp: number) => void;
  clear: () => void;
  setConnectionStatus: (
    status: AISConnectionStatus,
    error?: string | null,
  ) => void;
}

export const useAISStore = create<AISState>((set) => ({
  vessels: {},
  connectionStatus: 'disconnected',
  error: null,
  applyUpdates: (updates) =>
    set((state) => {
      if (updates.length === 0) {
        return state;
      }

      const vessels = { ...state.vessels };
      for (const update of updates) {
        const current = vessels[update.mmsi];
        vessels[update.mmsi] = {
          ...update,
          name: update.name ?? current?.name ?? null,
          shipType: update.shipType ?? current?.shipType ?? null,
          dimensions: update.dimensions ?? current?.dimensions ?? null,
        };
      }
      return { vessels };
    }),
  expireBefore: (cutoffTimestamp) =>
    set((state) => {
      const vessels = Object.fromEntries(
        Object.entries(state.vessels).filter(
          ([, vessel]) => Date.parse(vessel.lastUpdate) >= cutoffTimestamp,
        ),
      );
      return Object.keys(vessels).length === Object.keys(state.vessels).length
        ? state
        : { vessels };
    }),
  clear: () =>
    set({
      vessels: {},
      connectionStatus: 'disconnected',
      error: null,
    }),
  setConnectionStatus: (connectionStatus, error = null) =>
    set({ connectionStatus, error }),
}));
