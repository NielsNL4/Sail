import { useEffect, useState } from 'react';

import {
  useDevelopmentLocationStore,
  useLayersStore,
  useSettingsStore,
} from '@/stores';

function storesHaveHydrated(): boolean {
  return (
    useLayersStore.persist.hasHydrated() &&
    useSettingsStore.persist.hasHydrated() &&
    (!__DEV__ || useDevelopmentLocationStore.persist.hasHydrated())
  );
}

export function usePersistedStoresReady(): boolean {
  const [ready, setReady] = useState(storesHaveHydrated);

  useEffect(() => {
    const updateReady = () => setReady(storesHaveHydrated());
    const markLoading = () => setReady(false);
    const unsubscribers = [
      useLayersStore.persist.onHydrate(markLoading),
      useLayersStore.persist.onFinishHydration(updateReady),
      useSettingsStore.persist.onHydrate(markLoading),
      useSettingsStore.persist.onFinishHydration(updateReady),
      useDevelopmentLocationStore.persist.onHydrate(markLoading),
      useDevelopmentLocationStore.persist.onFinishHydration(updateReady),
    ];

    updateReady();
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  return ready;
}
