import type { Coordinates } from './Location';

export type WeatherProviderId = 'knmi' | 'open-meteo' | 'open-weather-map';

export interface WindData {
  speedMetersPerSecond: number;
  gustMetersPerSecond: number | null;
  directionDegrees: number;
}

export interface WindVector {
  coordinates: Coordinates;
  eastwardMetersPerSecond: number;
  northwardMetersPerSecond: number;
  speedMetersPerSecond: number;
}

export interface WindFieldBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface WindField {
  bounds: WindFieldBounds;
  columns: number;
  rows: number;
  vectors: WindVector[];
  validAt: string;
  fetchedAt: string;
  provider: 'open-meteo';
}

export interface CurrentWeather {
  coordinates: Coordinates;
  temperatureCelsius: number | null;
  wind: WindData;
  conditionCode: string | null;
  observedAt: string;
}

export interface WeatherForecastPoint {
  startsAt: string;
  temperatureCelsius: number | null;
  precipitationProbabilityPercent: number | null;
  wind: WindData;
}

export interface WeatherData {
  current: CurrentWeather;
  forecast: WeatherForecastPoint[];
  provider: WeatherProviderId;
  fetchedAt: string;
  isCached: boolean;
}
