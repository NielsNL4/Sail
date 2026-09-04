import { describe, expect, it, vi } from 'vitest';

import {
  createFairwayNetworkService,
  parseCemtClass,
} from './FairwayNetworkService';

const region = {
  latitude: 52,
  longitude: 5,
  latitudeDelta: 2,
  longitudeDelta: 4,
};

describe('FairwayNetworkService', () => {
  it('parses CEMT classes from VNDS codes and descriptions', () => {
    expect(parseCemtClass('_0', 'Kleine vaartuigen')).toBe('0');
    expect(parseCemtClass('VIc', null)).toBe('VIc');
    expect(parseCemtClass('unknown', 'Recreatie')).toBe('unknown');
  });

  it('requests and paginates VNDS GeoJSON features', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          features: [
            {
              id: 'segment-1',
              properties: {
                code: '_0',
                classification: 'CEMT',
                description: 'Kleine vaartuigen',
                name: 'Testvaarweg',
              },
              geometry: {
                type: 'MultiLineString',
                coordinates: [
                  [
                    [5, 52],
                    [5.1, 52.1],
                  ],
                ],
              },
            },
          ],
          links: [{ rel: 'next', href: 'https://example.test/next' }],
        },
      })
      .mockResolvedValueOnce({ data: { features: [], links: [] } });
    const service = createFairwayNetworkService({ get });

    const result = await service.getSegments({ region });

    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1].params).toMatchObject({
      bbox: '3,51,7,53',
      f: 'json',
    });
    expect(result[0]).toMatchObject({
      id: 'segment-1',
      cemtClass: '0',
      name: 'Testvaarweg',
    });
  });
});
