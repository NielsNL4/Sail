export const WEATHER_FRESHNESS_MS = 15 * 60 * 1_000;

export function isTimestampStale(
  timestamp: string,
  maxAgeMs: number,
  now = Date.now(),
): boolean {
  const time = new Date(timestamp).getTime();

  return !Number.isFinite(time) || now - time >= maxAgeMs;
}

export function formatDataTimestamp(timestamp: string): string {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
