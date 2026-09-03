import { create } from 'axios';
import axiosRetry, {
  exponentialDelay,
  isNetworkOrIdempotentRequestError,
} from 'axios-retry';

export const apiClient = create({
  timeout: 12_000,
  headers: {
    Accept: 'application/json',
  },
});

axiosRetry(apiClient, {
  retries: 2,
  retryCondition: isNetworkOrIdempotentRequestError,
  retryDelay: exponentialDelay,
});
