import { isAxiosError, isCancel } from 'axios';

export type ApiErrorKind =
  'canceled' | 'timeout' | 'network' | 'http' | 'invalid-response' | 'unknown';

export interface ApiErrorContext {
  operation: string;
  provider: string;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly operation: string;
  readonly provider: string;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(
    message: string,
    context: ApiErrorContext,
    options: {
      cause: unknown;
      kind: ApiErrorKind;
      retryable: boolean;
      status?: number;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = options.kind;
    this.operation = context.operation;
    this.provider = context.provider;
    this.retryable = options.retryable;
    this.status = options.status ?? null;
  }
}

export function normalizeApiError(
  error: unknown,
  context: ApiErrorContext,
): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (
    isCancel(error) ||
    (error instanceof Error && error.name === 'AbortError')
  ) {
    return new ApiError('Request canceled.', context, {
      cause: error,
      kind: 'canceled',
      retryable: false,
    });
  }

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError('The API request timed out.', context, {
        cause: error,
        kind: 'timeout',
        retryable: true,
      });
    }

    if (error.response) {
      const status = error.response.status;
      return new ApiError(
        'The API returned an unsuccessful response.',
        context,
        {
          cause: error,
          kind: 'http',
          retryable: status === 408 || status === 429 || status >= 500,
          status,
        },
      );
    }

    if (error.request) {
      return new ApiError('The API could not be reached.', context, {
        cause: error,
        kind: 'network',
        retryable: true,
      });
    }
  }

  if (error instanceof Error) {
    return new ApiError('The API returned invalid data.', context, {
      cause: error,
      kind: 'invalid-response',
      retryable: false,
    });
  }

  return new ApiError('An unexpected API error occurred.', context, {
    cause: error,
    kind: 'unknown',
    retryable: false,
  });
}
