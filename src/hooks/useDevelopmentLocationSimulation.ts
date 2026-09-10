import { useEffect } from 'react';

import { useDevelopmentLocationStore } from '@/stores';

export function useDevelopmentLocationSimulation(): void {
  const enabled = useDevelopmentLocationStore((state) => state.enabled);
  const running = useDevelopmentLocationStore((state) => state.running);

  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__ || !enabled || !running) {
      return;
    }

    const interval = setInterval(
      () => useDevelopmentLocationStore.getState().advance(),
      1_000,
    );
    return () => clearInterval(interval);
  }, [enabled, running]);
}
