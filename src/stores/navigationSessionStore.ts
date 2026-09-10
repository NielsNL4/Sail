import { create } from 'zustand';

import type {
  Coordinates,
  NavigationSession,
  NavigationStatus,
  NavigationTarget,
  TrackPoint,
} from '@/types';
import { MAX_TRACK_POINTS } from '../utils/navigationCalculations';

interface NavigationSessionState {
  status: NavigationStatus;
  session: NavigationSession | null;
  error: string | null;
  begin: (target: NavigationTarget) => void;
  activate: (startCoordinates: Coordinates) => void;
  appendTrackPoint: (point: TrackPoint) => void;
  markArrived: () => void;
  fail: (error: string) => void;
  stop: () => void;
}

const initialState = {
  status: 'idle' as const,
  session: null,
  error: null,
};

export const useNavigationSessionStore = create<NavigationSessionState>()(
  (set) => ({
    ...initialState,
    begin: (target) =>
      set({
        status: 'acquiring',
        session: {
          target,
          startedAt: new Date().toISOString(),
          startCoordinates: null,
          track: [],
        },
        error: null,
      }),
    activate: (startCoordinates) =>
      set((state) => ({
        status: state.session ? 'navigating' : state.status,
        session: state.session
          ? { ...state.session, startCoordinates }
          : state.session,
      })),
    appendTrackPoint: (point) =>
      set((state) => ({
        session: state.session
          ? {
              ...state.session,
              track: [...state.session.track, point].slice(-MAX_TRACK_POINTS),
            }
          : null,
      })),
    markArrived: () => set({ status: 'arrived' }),
    fail: (error) => set({ status: 'error', error }),
    stop: () => set(initialState),
  }),
);
