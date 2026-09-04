import { describe, expect, it } from 'vitest';

import { createBridgeLockService } from './BridgeLockService';

describe('BridgeLockService', () => {
  it('exposes an explicit unavailable state instead of fabricating structures', async () => {
    const service = createBridgeLockService();

    expect(service.status).toBe('unavailable');
    expect(service.unavailableReason).toContain('FIS');
    await expect(
      service.getStructures({
        region: {
          latitude: 52,
          longitude: 5,
          latitudeDelta: 1,
          longitudeDelta: 1,
        },
      }),
    ).resolves.toEqual([]);
  });
});
