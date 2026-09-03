import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../services/ApiError';

import { logApiError } from './logger';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

describe('logApiError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs safe structured fields on web', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const error = new ApiError(
      'The API could not be reached.',
      { operation: 'loadWindField', provider: 'open-meteo' },
      { cause: new Error('private detail'), kind: 'network', retryable: true },
    );

    logApiError(error);

    expect(consoleError).toHaveBeenCalledWith('[api] loadWindField failed', {
      kind: 'network',
      message: 'The API could not be reached.',
      provider: 'open-meteo',
      retryable: true,
      status: null,
    });
  });

  it('does not log canceled requests', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const error = new ApiError(
      'Request canceled.',
      { operation: 'loadWindField', provider: 'open-meteo' },
      { cause: null, kind: 'canceled', retryable: false },
    );

    logApiError(error);

    expect(consoleError).not.toHaveBeenCalled();
  });
});
