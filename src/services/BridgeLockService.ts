import type { BridgeLock, NavigationQuery } from '@/types';

export type BridgeLockProviderStatus = 'unavailable';

export interface BridgeLockService {
  readonly status: BridgeLockProviderStatus;
  readonly unavailableReason: string;
  getStructures: (query: NavigationQuery) => Promise<BridgeLock[]>;
}

const FIS_UNAVAILABLE_REASON =
  'Er is nog geen officieel openbaar machineleesbaar FIS- of DISK-bestand bevestigd.';

export function createBridgeLockService(): BridgeLockService {
  return {
    status: 'unavailable',
    unavailableReason: FIS_UNAVAILABLE_REASON,
    async getStructures() {
      // An empty result is deliberate: it must not be mistaken for a complete dataset.
      return [];
    },
  };
}

export const bridgeLockService = createBridgeLockService();
