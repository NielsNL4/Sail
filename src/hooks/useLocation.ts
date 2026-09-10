import { useEffect } from 'react';
import { foregroundLocation } from '../services/foregroundLocation';
import { useLocationStore } from '@/stores';

export function useForegroundLocation(): void {
  useEffect(() => foregroundLocation.mount(), []);
}

export function useLocation() {
  const location = useLocationStore((state) => state.location);
  const permissionStatus = useLocationStore((state) => state.permissionStatus);
  const isLocating = useLocationStore((state) => state.isLocating);
  const error = useLocationStore((state) => state.error);

  return {
    location,
    permissionStatus,
    isLocating,
    isMocked: location?.isMocked ?? false,
    isDevelopmentLocation: location?.source === 'development',
    error,
    requestLocation: foregroundLocation.request,
  };
}
