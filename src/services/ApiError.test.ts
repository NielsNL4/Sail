import { describe, expect, it } from 'vitest';

import { normalizeApiError } from './ApiError';

const context = {
  operation: 'loadWindField',
  provider: 'open-meteo',
};

function axiosError(overrides: Record<string, unknown>) {
  return {
    isAxiosError: true,
    message: 'Sensitive upstream detail',
    name: 'AxiosError',
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('normalizeApiError', () => {
  it('normalizes timeouts without exposing the upstream message', () => {
    const error = normalizeApiError(
      axiosError({ code: 'ECONNABORTED' }),
      context,
    );

    expect(error).toMatchObject({
      kind: 'timeout',
      operation: 'loadWindField',
      provider: 'open-meteo',
      retryable: true,
      status: null,
    });
    expect(error.message).not.toContain('Sensitive');
  });

  it('classifies retryable and non-retryable HTTP responses', () => {
    expect(
      normalizeApiError(axiosError({ response: { status: 503 } }), context),
    ).toMatchObject({ kind: 'http', retryable: true, status: 503 });
    expect(
      normalizeApiError(axiosError({ response: { status: 400 } }), context),
    ).toMatchObject({ kind: 'http', retryable: false, status: 400 });
  });

  it('recognizes canceled requests', () => {
    expect(normalizeApiError({ __CANCEL__: true }, context).kind).toBe(
      'canceled',
    );
  });
});
