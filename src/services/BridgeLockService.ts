import { decompressSync } from 'fflate';

import type { BridgeLock, NavigationQuery } from '@/types';

export type BridgeLockProviderStatus = 'available' | 'degraded' | 'unavailable';

export const NDW_BRIDGE_OPENINGS_URL =
  'https://opendata.ndw.nu/planningsfeed_brugopeningen.xml.gz';
export const NDW_BRIDGE_RELAY_PATH = '/ndw/bridge-openings.xml.gz';
export const NDW_LIVE_CACHE_TTL_MS = 3 * 60 * 1_000;

export interface DatexBridgeStatus {
  id: string;
  position: { latitude: number; longitude: number };
  liveStatus: BridgeLock['liveStatus'];
  liveStatusUpdatedAt: string | null;
}

export interface BridgeLockService {
  readonly status: BridgeLockProviderStatus;
  readonly unavailableReason: string;
  getStructures: (query: NavigationQuery) => Promise<BridgeLock[]>;
  refreshLiveStatuses: () => Promise<void>;
}

const NDW_UNAVAILABLE_REASON =
  'NDW-brugopeningen zijn tijdelijk niet beschikbaar.';

function tagValue(xml: string, name: string): string | null {
  const match = xml.match(
    new RegExp(
      `<(?:[\\w.-]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`,
    ),
  );
  return match?.[1].replace(/<[^>]+>/g, '').trim() || null;
}

export function parseNDWBridgeOpenings(
  xml: string,
  now = new Date(),
): DatexBridgeStatus[] {
  const records =
    xml.match(
      /<[^>]*situationRecord\b[^>]*>[\s\S]*?<\/[^>]*situationRecord>/g,
    ) ?? [];
  const byId = new Map<string, DatexBridgeStatus>();
  const currentTime = now.getTime();

  for (const record of records) {
    const id = tagValue(record, 'externalLocationCode');
    const latitude = Number(tagValue(record, 'latitude'));
    const longitude = Number(tagValue(record, 'longitude'));
    const start = Date.parse(tagValue(record, 'overallStartTime') ?? '');
    const end = Date.parse(tagValue(record, 'overallEndTime') ?? '');
    const updatedAt = tagValue(record, 'situationRecordVersionTime');
    if (!id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      continue;
    }

    const active =
      Number.isFinite(start) &&
      start <= currentTime &&
      (!Number.isFinite(end) || currentTime < end);
    const existing = byId.get(id);
    if (existing?.liveStatus === 'open' && !active) continue;

    byId.set(id, {
      id,
      position: { latitude, longitude },
      liveStatus: active ? 'open' : 'unknown',
      liveStatusUpdatedAt: updatedAt,
    });
  }

  return [...byId.values()];
}

async function fetchNDWBridgeOpenings(
  fetcher: typeof fetch,
): Promise<DatexBridgeStatus[]> {
  const relayUrl = process.env.EXPO_PUBLIC_NDW_RELAY_URL;
  const url = relayUrl
    ? `${relayUrl.replace(/\/$/, '')}${NDW_BRIDGE_RELAY_PATH}`
    : NDW_BRIDGE_OPENINGS_URL;
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`NDW HTTP ${response.status}`);
  const compressed = new Uint8Array(await response.arrayBuffer());
  const xml = new TextDecoder().decode(decompressSync(compressed));
  return parseNDWBridgeOpenings(xml);
}

function inQuery(
  position: DatexBridgeStatus['position'],
  query: NavigationQuery,
): boolean {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = query.region;
  return (
    Math.abs(position.latitude - latitude) <= latitudeDelta / 2 &&
    Math.abs(position.longitude - longitude) <= longitudeDelta / 2
  );
}

export function createBridgeLockService(
  fetcher: typeof fetch = fetch,
): BridgeLockService {
  let liveStatuses: DatexBridgeStatus[] = [];
  let liveFetchedAt = 0;
  let status: BridgeLockProviderStatus = 'unavailable';
  let refreshPromise: Promise<void> | null = null;

  const refreshLiveStatuses = async () => {
    if (refreshPromise) return refreshPromise;
    refreshPromise = fetchNDWBridgeOpenings(fetcher)
      .then((statuses) => {
        liveStatuses = statuses;
        liveFetchedAt = Date.now();
        status = 'available';
      })
      .catch(() => {
        status = liveStatuses.length > 0 ? 'degraded' : 'unavailable';
      })
      .finally(() => {
        refreshPromise = null;
      });
    return refreshPromise;
  };

  return {
    get status() {
      return status;
    },
    unavailableReason: NDW_UNAVAILABLE_REASON,
    refreshLiveStatuses,
    async getStructures(query) {
      if (Date.now() - liveFetchedAt > NDW_LIVE_CACHE_TTL_MS) {
        await refreshLiveStatuses();
      }
      return liveStatuses
        .filter((bridge) => inQuery(bridge.position, query))
        .map((bridge) => ({
          id: bridge.id,
          name: `Brug ${bridge.id}`,
          position: bridge.position,
          kind: 'bridge' as const,
          statusSource: 'scheduled' as const,
          liveStatus: bridge.liveStatus,
          liveStatusUpdatedAt: bridge.liveStatusUpdatedAt,
          scheduledOperatingTimes: null,
          vhfChannel: null,
          phoneNumber: null,
          clearanceHeightMeters: null,
          widthMeters: null,
          lengthMeters: null,
        }));
    },
  };
}

export const bridgeLockService = createBridgeLockService();
