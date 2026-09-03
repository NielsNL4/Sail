import { create } from 'zustand';

import type { ApiError } from '@/services';
import type { WindField } from '@/types';

interface WindFieldState {
  field: WindField | null;
  isLoading: boolean;
  error: ApiError | null;
  startLoading: () => void;
  setField: (field: WindField) => void;
  setError: (error: ApiError) => void;
}

export const useWindFieldStore = create<WindFieldState>((set) => ({
  field: null,
  isLoading: false,
  error: null,
  startLoading: () => set({ isLoading: true, error: null }),
  setField: (field) => set({ field, isLoading: false, error: null }),
  setError: (error) => set({ error, isLoading: false }),
}));
