import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'fflate';

import {
  createBridgeLockService,
  NDW_BRIDGE_OPENINGS_URL,
  parseNDWBridgeOpenings,
} from './BridgeLockService';

const datex = (start: string, end: string) => `
  <sit:situationRecord>
    <sit:situationRecordVersionTime>2026-09-04T10:00:00Z</sit:situationRecordVersionTime>
    <sit:validity><com:validityTimeSpecification>
      <com:overallStartTime>${start}</com:overallStartTime>
      <com:overallEndTime>${end}</com:overallEndTime>
    </com:validityTimeSpecification></sit:validity>
    <sit:locationReference><loc:externalReferencing>
      <loc:externalLocationCode>NL.BRIDGE.001</loc:externalLocationCode>
    </loc:externalReferencing><loc:pointByCoordinates><loc:pointCoordinates>
      <loc:latitude>52.1</loc:latitude><loc:longitude>5.1</loc:longitude>
    </loc:pointCoordinates></loc:pointByCoordinates></sit:locationReference>
  </sit:situationRecord>`;

describe('BridgeLockService', () => {
  it('parses an active opening as open and inactive records as unknown', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const statuses = parseNDWBridgeOpenings(
      `<root>${datex('2026-09-04T11:00:00Z', '2026-09-04T13:00:00Z')}</root>`,
      now,
    );
    expect(statuses).toEqual([
      {
        id: 'NL.BRIDGE.001',
        position: { latitude: 52.1, longitude: 5.1 },
        liveStatus: 'open',
        liveStatusUpdatedAt: '2026-09-04T10:00:00Z',
      },
    ]);

    expect(
      parseNDWBridgeOpenings(
        `<root>${datex('2026-09-04T13:00:00Z', '2026-09-04T14:00:00Z')}</root>`,
        now,
      )[0].liveStatus,
    ).toBe('unknown');
  });

  it('caches live data and filters structures to the requested region', async () => {
    const response = new Response(
      gzipSync(
        new TextEncoder().encode(
          `<root>${datex('2026-09-04T11:00:00Z', '2026-09-04T13:00:00Z')}</root>`,
        ),
      ),
      { status: 200 },
    );
    const fetcher = vi.fn().mockResolvedValue(response);
    const service = createBridgeLockService(fetcher);
    const query = {
      region: {
        latitude: 52.1,
        longitude: 5.1,
        latitudeDelta: 1,
        longitudeDelta: 1,
      },
    };

    await expect(service.getStructures(query)).resolves.toHaveLength(1);
    await expect(service.getStructures(query)).resolves.toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(NDW_BRIDGE_OPENINGS_URL);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
