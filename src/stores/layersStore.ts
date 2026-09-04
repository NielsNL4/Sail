import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type LayerId =
  | 'wind'
  | 'depth'
  | 'vessels'
  | 'fairway'
  | 'buoys'
  | 'bridgesLocks'
  | 'tides'
  | 'waypoints'
  | 'weatherWarnings';

export type LayerVisibility = Record<LayerId, boolean>;

interface LayersState {
  visibility: LayerVisibility;
  setLayerVisibility: (layer: LayerId, isVisible: boolean) => void;
  toggleLayer: (layer: LayerId) => void;
  resetLayers: () => void;
}

const defaultVisibility: LayerVisibility = {
  wind: true,
  depth: false,
  vessels: false,
  fairway: false,
  buoys: false,
  bridgesLocks: false,
  tides: false,
  waypoints: false,
  weatherWarnings: true,
};

export const useLayersStore = create<LayersState>()(
  persist(
    (set) => ({
      visibility: defaultVisibility,
      setLayerVisibility: (layer, isVisible) =>
        set((state) => ({
          visibility: { ...state.visibility, [layer]: isVisible },
        })),
      toggleLayer: (layer) =>
        set((state) => ({
          visibility: {
            ...state.visibility,
            [layer]: !state.visibility[layer],
          },
        })),
      resetLayers: () => set({ visibility: defaultVisibility }),
    }),
    {
      name: 'sail-layers',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ visibility }) => ({ visibility }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<LayersState>;
        return {
          ...current,
          ...saved,
          visibility: {
            ...defaultVisibility,
            ...saved.visibility,
          },
        };
      },
    },
  ),
);
