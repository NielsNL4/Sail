import { Platform } from 'react-native';

import type { ApiError } from '@/services/ApiError';

export function logApiError(error: ApiError): void {
  if (Platform.OS !== 'web' || error.kind === 'canceled') {
    return;
  }

  console.error(`[api] ${error.operation} failed`, {
    kind: error.kind,
    message: error.message,
    provider: error.provider,
    retryable: error.retryable,
    status: error.status,
  });
}
