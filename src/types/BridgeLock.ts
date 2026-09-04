import type { Coordinates } from './Location';

export interface BridgeLock {
  id: string;
  name: string;
  position: Coordinates;
  kind: 'bridge' | 'lock';
  statusSource: 'live' | 'scheduled';
  liveStatus: 'open' | 'closed' | 'unknown';
  liveStatusUpdatedAt: string | null;
  scheduledOperatingTimes: string | null;
  vhfChannel: string | null;
  phoneNumber: string | null;
  clearanceHeightMeters: number | null;
  widthMeters: number | null;
  lengthMeters: number | null;
}
