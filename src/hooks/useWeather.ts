import { useEffect } from 'react';

import { strings } from '@/i18n';
import { normalizeApiError, weatherService } from '@/services';
import { useWeatherStore } from '@/stores';
import type { Coordinates } from '@/types';
import { logApiError } from '@/utils';

const WEATHER_CACHE_DURATION_MS = 15 * 60 * 1_000;

function isFreshForCoordinates(
  coordinates: Coordinates,
  fetchedAt: string,
  weatherCoordinates: Coordinates,
) {
  const age = Date.now() - new Date(fetchedAt).getTime();
  const nearRequestedPoint =
    Math.abs(coordinates.latitude - weatherCoordinates.latitude) < 0.1 &&
    Math.abs(coordinates.longitude - weatherCoordinates.longitude) < 0.1;

  return age < WEATHER_CACHE_DURATION_MS && nearRequestedPoint;
}

export function useWeather(coordinates: Coordinates, enabled: boolean) {
  const weather = useWeatherStore((state) => state.weather);
  const isLoading = useWeatherStore((state) => state.isLoading);
  const error = useWeatherStore((state) => state.error);
  const setWeather = useWeatherStore((state) => state.setWeather);
  const setLoading = useWeatherStore((state) => state.setLoading);
  const setError = useWeatherStore((state) => state.setError);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (
      weather &&
      isFreshForCoordinates(
        coordinates,
        weather.fetchedAt,
        weather.current.coordinates,
      )
    ) {
      return;
    }

    const controller = new AbortController();
    setError(null);
    setLoading(true);

    weatherService
      .getWeather(coordinates, controller.signal)
      .then(setWeather)
      .catch((requestError: unknown) => {
        const apiError = normalizeApiError(requestError, {
          operation: 'loadWeather',
          provider: 'open-meteo',
        });

        if (apiError.kind === 'canceled') {
          return;
        }

        logApiError(apiError);
        setError(strings.weatherUnavailable);
      });

    return () => controller.abort();
  }, [coordinates, enabled, setError, setLoading, setWeather, weather]);

  return { weather, isLoading, error };
}
