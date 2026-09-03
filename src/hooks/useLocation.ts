import { strings } from '@/i18n';
import { locationService } from '@/services';
import { useLocationStore } from '@/stores';

export function useLocation() {
  const location = useLocationStore((state) => state.location);
  const permissionStatus = useLocationStore((state) => state.permissionStatus);
  const isTracking = useLocationStore((state) => state.isTracking);
  const error = useLocationStore((state) => state.error);
  const setLocation = useLocationStore((state) => state.setLocation);
  const setPermissionStatus = useLocationStore(
    (state) => state.setPermissionStatus,
  );
  const setTracking = useLocationStore((state) => state.setTracking);
  const setError = useLocationStore((state) => state.setError);

  const requestLocation = async () => {
    setError(null);
    setTracking(true);

    try {
      const result = await locationService.getCurrentLocation();
      setPermissionStatus(result.permissionStatus);
      setLocation(result.location);
      setTracking(false);

      return result.location;
    } catch {
      setError(strings.locationUnavailable);
      return null;
    }
  };

  return {
    location,
    permissionStatus,
    isTracking,
    isMocked: location?.isMocked ?? false,
    error,
    requestLocation,
  };
}
