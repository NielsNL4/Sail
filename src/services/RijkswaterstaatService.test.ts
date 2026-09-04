import { describe, expect, it, vi } from 'vitest';

import {
  createRijkswaterstaatService,
  parseDepthSample,
} from './RijkswaterstaatService';

describe('RijkswaterstaatService', () => {
  it('parses common WMS raster feature-info formats', () => {
    expect(parseDepthSample('GRAY_INDEX = -4.25')).toBe(-4.25);
    expect(
      parseDepthSample({ features: [{ properties: { value: -2.5 } }] }),
    ).toBe(-2.5);
    expect(parseDepthSample('no data')).toBeNull();
    expect(parseDepthSample('GRAY_INDEX = -3.4e38')).toBe(-3.4e38);
  });

  it('queries only the requested 20 m source', async () => {
    const get = vi.fn().mockResolvedValue({ data: 'pixel value: -1.2' });
    const service = createRijkswaterstaatService({ get });
    const sample = await service.getDepthAt(
      { latitude: 52, longitude: 4 },
      'coastal-20m',
    );

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('bodemhoogte_20mtr'),
      expect.objectContaining({
        timeout: 4_000,
        'axios-retry': { retries: 0 },
        params: expect.objectContaining({ LAYERS: 'bodemhoogte_20mtr' }),
      }),
    );
    expect(sample).toMatchObject({
      bottomElevationMetersNap: -1.2,
      source: 'coastal-20m',
    });
  });

  it('queries only the requested 1 m source', async () => {
    const get = vi.fn().mockResolvedValue({ data: 'GRAY_INDEX = -3.5' });
    const service = createRijkswaterstaatService({ get });
    const sample = await service.getDepthAt(
      { latitude: 52.75, longitude: 5.35 },
      'inland-1m',
    );

    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(
      expect.stringContaining('bodemhoogte_1mtr_historie'),
      expect.objectContaining({
        params: expect.objectContaining({
          LAYERS: 'bodemhoogte_1mtr_202602',
        }),
      }),
    );
    expect(sample).toMatchObject({
      bottomElevationMetersNap: -3.5,
      source: 'inland-1m',
    });
  });

  it('retains valid positive NAP bottom elevations', async () => {
    const get = vi.fn().mockResolvedValue({ data: 'GRAY_INDEX = 0.5' });
    const service = createRijkswaterstaatService({ get });

    await expect(
      service.getDepthAt({ latitude: 52, longitude: 5 }, 'inland-1m'),
    ).resolves.toMatchObject({ bottomElevationMetersNap: 0.5 });
  });

  it('omits raster no-data sentinel values', async () => {
    const get = vi.fn().mockResolvedValue({ data: 'GRAY_INDEX = -3.4e38' });
    const service = createRijkswaterstaatService({ get });

    await expect(
      service.getDepthAt({ latitude: 52, longitude: 5 }, 'inland-1m'),
    ).resolves.toBeNull();
  });
});
