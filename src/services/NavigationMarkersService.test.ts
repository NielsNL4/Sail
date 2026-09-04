import { describe, expect, it, vi } from 'vitest';

import { createNavigationMarkersService } from './NavigationMarkersService';

describe('NavigationMarkersService', () => {
  it('combines floating and fixed marker collections', async () => {
    const get = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        data: {
          features: [
            {
              id: url.includes('drijvend') ? 'buoy-1' : 'beacon-1',
              properties: {
                benaming: 'ZW 2',
                benam_cod: 'VW-1',
                obj_soort: 'spar',
                obj_kleur: 'Groen',
                kleurpatr: 'Verticaal',
                vaarwater: 'Testwater',
              },
              geometry: {
                type: 'MultiPoint',
                coordinates: [[5, 52]],
              },
            },
          ],
        },
      }),
    );
    const service = createNavigationMarkersService({ get });

    const result = await service.getMarkers({
      region: {
        latitude: 52,
        longitude: 5,
        latitudeDelta: 2,
        longitudeDelta: 4,
      },
    });

    expect(get).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'buoy-buoy-1',
          type: 'buoy',
          color: 'Groen',
          colorPattern: 'Verticaal',
        }),
        expect.objectContaining({ id: 'beacon-beacon-1', type: 'beacon' }),
      ]),
    );
  });
});
