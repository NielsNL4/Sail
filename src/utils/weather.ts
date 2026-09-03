import type { TemperatureUnit, WindSpeedUnit } from '@/stores';

const COMPASS_POINTS = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'] as const;

export function directionToCompass(directionDegrees: number): string {
  const normalizedDirection = ((directionDegrees % 360) + 360) % 360;
  const index = Math.round(normalizedDirection / 45) % COMPASS_POINTS.length;

  return COMPASS_POINTS[index];
}

export function formatWindSpeed(
  metersPerSecond: number,
  unit: WindSpeedUnit,
): string {
  if (unit === 'knots') {
    return `${Math.round(metersPerSecond * 1.943_844)} kn`;
  }

  if (unit === 'beaufort') {
    const thresholds = [
      0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7,
    ];
    const beaufort = thresholds.findIndex(
      (threshold) => metersPerSecond < threshold,
    );

    return `${beaufort === -1 ? 12 : beaufort} Bft`;
  }

  return `${metersPerSecond.toFixed(1)} m/s`;
}

export function formatTemperature(
  celsius: number | null,
  unit: TemperatureUnit,
): string | null {
  if (celsius === null) {
    return null;
  }

  if (unit === 'fahrenheit') {
    return `${Math.round((celsius * 9) / 5 + 32)} °F`;
  }

  return `${Math.round(celsius)} °C`;
}
