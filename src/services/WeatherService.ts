import type { AxiosInstance } from 'axios';

import type {
  Coordinates,
  WeatherData,
  WeatherForecastPoint,
  WindData,
} from '@/types';

import { apiClient } from './apiClient';

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoCurrent {
  time: string;
  temperature_2m: number | null;
  weather_code: number | null;
  wind_speed_10m: number | null;
  wind_direction_10m: number | null;
  wind_gusts_10m: number | null;
}

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: (number | null)[];
  precipitation_probability: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
}

interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  current: OpenMeteoCurrent;
  hourly: OpenMeteoHourly;
}

export interface WeatherService {
  getWeather: (
    coordinates: Coordinates,
    signal?: AbortSignal,
  ) => Promise<WeatherData>;
}

function normalizeUtcTime(value: string): string {
  const date = new Date(value.endsWith('Z') ? value : `${value}Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Open-Meteo returned an invalid forecast time.');
  }

  return date.toISOString();
}

function normalizeWind(
  speedMetersPerSecond: number | null,
  gustMetersPerSecond: number | null,
  directionDegrees: number | null,
): WindData {
  if (speedMetersPerSecond === null || directionDegrees === null) {
    throw new Error('Open-Meteo returned incomplete wind data.');
  }

  return {
    speedMetersPerSecond,
    gustMetersPerSecond,
    directionDegrees,
  };
}

function normalizeForecast(hourly: OpenMeteoHourly): WeatherForecastPoint[] {
  return hourly.time.map((startsAt, index) => ({
    startsAt: normalizeUtcTime(startsAt),
    temperatureCelsius: hourly.temperature_2m[index] ?? null,
    precipitationProbabilityPercent:
      hourly.precipitation_probability[index] ?? null,
    wind: normalizeWind(
      hourly.wind_speed_10m[index] ?? null,
      hourly.wind_gusts_10m[index] ?? null,
      hourly.wind_direction_10m[index] ?? null,
    ),
  }));
}

export function normalizeOpenMeteoResponse(
  response: OpenMeteoResponse,
  fetchedAt = new Date().toISOString(),
): WeatherData {
  return {
    current: {
      coordinates: {
        latitude: response.latitude,
        longitude: response.longitude,
      },
      temperatureCelsius: response.current.temperature_2m,
      wind: normalizeWind(
        response.current.wind_speed_10m,
        response.current.wind_gusts_10m,
        response.current.wind_direction_10m,
      ),
      conditionCode:
        response.current.weather_code === null
          ? null
          : String(response.current.weather_code),
      observedAt: normalizeUtcTime(response.current.time),
    },
    forecast: normalizeForecast(response.hourly),
    provider: 'open-meteo',
    fetchedAt,
    isCached: false,
  };
}

export function createWeatherService(
  client: Pick<AxiosInstance, 'get'>,
): WeatherService {
  return {
    async getWeather(coordinates, signal) {
      const response = await client.get<OpenMeteoResponse>(
        OPEN_METEO_FORECAST_URL,
        {
          signal,
          params: {
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            current:
              'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
            hourly:
              'temperature_2m,precipitation_probability,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
            wind_speed_unit: 'ms',
            timezone: 'UTC',
            forecast_days: 2,
            models: 'knmi_seamless',
            cell_selection: 'sea',
          },
        },
      );

      return normalizeOpenMeteoResponse(response.data);
    },
  };
}

export const weatherService = createWeatherService(apiClient);
