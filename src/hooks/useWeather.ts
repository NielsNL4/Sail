import { useEffect, useState } from 'react';

import { strings } from '@/i18n';
import { normalizeApiError, weatherService } from '@/services';
import { useWeatherStore } from '@/stores';
import type { Coordinates } from '@/types';
import { logApiError, WEATHER_FRESHNESS_MS } from '@/utils';

const WEATHER_RETRY_DELAY_MS = 60 * 1_000;

function isFreshForCoordinates(
  coordinates: Coordinates,
  fetchedAt: string,
  weatherCoordinates: Coordinates,
) {
  const age = Date.now() - new Date(fetchedAt).getTime();
  const nearRequestedPoint =
    Math.abs(coordinates.latitude - weatherCoordinates.latitude) < 0.1 &&
    Math.abs(coordinates.longitude - weatherCoordinates.longitude) < 0.1;

  return age < WEATHER_FRESHNESS_MS && nearRequestedPoint;
}

export function useWeather(
  coordinates: Coordinates,
  enabled: boolean,
  networkAvailable = true,
) {
  const [refreshTick, setRefreshTick] = useState(0);
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
      const age = Date.now() - new Date(weather.fetchedAt).getTime();
      const timeout = setTimeout(
        () => setRefreshTick((tick) => tick + 1),
        Math.max(0, WEATHER_FRESHNESS_MS - age),
      );

      return () => clearTimeout(timeout);
    }

    if (!networkAvailable) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    let retryTimeout: ReturnType<typeof setTimeout> | undefined;
    setError(null);
    setLoading(true);

    weatherService
      .getWeather(coordinates, controller.signal)
      .then((nextWeather) => {
        if (active) {
          setWeather(nextWeather);
        }
      })
      .catch((requestError: unknown) => {
        const apiError = normalizeApiError(requestError, {
          operation: 'loadWeather',
          provider: 'open-meteo',
        });

        if (apiError.kind === 'canceled' || !active) {
          return;
        }

        logApiError(apiError);
        setError(strings.weatherUnavailable);
        retryTimeout = setTimeout(
          () => setRefreshTick((tick) => tick + 1),
          WEATHER_RETRY_DELAY_MS,
        );
      });

    return () => {
      active = false;
      controller.abort();
      clearTimeout(retryTimeout);
      setLoading(false);
    };
  }, [
    coordinates,
    enabled,
    networkAvailable,
    refreshTick,
    setError,
    setLoading,
    setWeather,
    weather,
  ]);

  return { weather, isLoading, error };
}
