import { describe, expect, it, vi } from 'vitest';

import {
  createWeatherService,
  normalizeOpenMeteoResponse,
} from './WeatherService';

const openMeteoResponse = {
  latitude: 52.75,
  longitude: 5.35,
  current: {
    time: '2026-09-03T10:30',
    temperature_2m: 19.6,
    weather_code: 3,
    wind_speed_10m: 9.4,
    wind_direction_10m: 263,
    wind_gusts_10m: 12.3,
  },
  hourly: {
    time: ['2026-09-03T11:00'],
    temperature_2m: [19.6],
    precipitation_probability: [69],
    wind_speed_10m: [9.1],
    wind_direction_10m: [267],
    wind_gusts_10m: [12.2],
  },
};

describe('WeatherService', () => {
  it('normalizes Open-Meteo current conditions and forecast', () => {
    const weather = normalizeOpenMeteoResponse(
      openMeteoResponse,
      '2026-09-03T10:31:00.000Z',
    );

    expect(weather).toEqual({
      current: {
        coordinates: { latitude: 52.75, longitude: 5.35 },
        temperatureCelsius: 19.6,
        wind: {
          speedMetersPerSecond: 9.4,
          gustMetersPerSecond: 12.3,
          directionDegrees: 263,
        },
        conditionCode: '3',
        observedAt: '2026-09-03T10:30:00.000Z',
      },
      forecast: [
        {
          startsAt: '2026-09-03T11:00:00.000Z',
          temperatureCelsius: 19.6,
          precipitationProbabilityPercent: 69,
          wind: {
            speedMetersPerSecond: 9.1,
            gustMetersPerSecond: 12.2,
            directionDegrees: 267,
          },
        },
      ],
      provider: 'open-meteo',
      fetchedAt: '2026-09-03T10:31:00.000Z',
      isCached: false,
    });
  });

  it('requests the KNMI sea forecast in SI units', async () => {
    const get = vi.fn().mockResolvedValue({ data: openMeteoResponse });
    const service = createWeatherService({ get });

    await service.getWeather({ latitude: 52.75, longitude: 5.35 });

    expect(get).toHaveBeenCalledWith(
      'https://api.open-meteo.com/v1/forecast',
      expect.objectContaining({
        params: expect.objectContaining({
          latitude: 52.75,
          longitude: 5.35,
          models: 'knmi_seamless',
          cell_selection: 'sea',
          wind_speed_unit: 'ms',
          timezone: 'UTC',
        }),
      }),
    );
  });

  it('rejects incomplete wind data', () => {
    expect(() =>
      normalizeOpenMeteoResponse({
        ...openMeteoResponse,
        current: { ...openMeteoResponse.current, wind_speed_10m: null },
      }),
    ).toThrow('Open-Meteo returned incomplete wind data.');
  });
});
