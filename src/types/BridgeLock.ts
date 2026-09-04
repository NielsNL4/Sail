import type { Coordinates } from './Location';

export interface BridgeLock {
  id: string;
  name: string;
  position: Coordinates;
  operatingTimes: string | null;
  vhfChannel: string | null;
  phoneNumber: string | null;
  clearanceHeightMeters: number | null;
  widthMeters: number | null;
  lengthMeters: number | null;
}
