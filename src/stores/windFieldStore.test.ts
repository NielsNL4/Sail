import { beforeEach, describe, expect, it } from 'vitest';

import { ApiError } from '../services/ApiError';
import type { WindField } from '../types';

import { useWindFieldStore } from './windFieldStore';

const field = {
  bounds: { west: 4, south: 52, east: 6, north: 54 },
  columns: 0,
  rows: 0,
  vectors: [],
  validAt: '2026-09-03T12:00:00.000Z',
  fetchedAt: '2026-09-03T12:00:00.000Z',
  provider: 'open-meteo',
} satisfies WindField;

describe('windFieldStore', () => {
  beforeEach(() => {
    useWindFieldStore.setState({ field: null, isLoading: false, error: null });
  });

  it('retains stale field data when refresh fails', () => {
    useWindFieldStore.getState().setField(field);
    useWindFieldStore.getState().startLoading();
    useWindFieldStore
      .getState()
      .setError(
        new ApiError(
          'The API could not be reached.',
          { operation: 'loadWindField', provider: 'open-meteo' },
          { cause: null, kind: 'network', retryable: true },
        ),
      );

    expect(useWindFieldStore.getState()).toMatchObject({
      field,
      isLoading: false,
      error: { kind: 'network' },
    });
  });
});
