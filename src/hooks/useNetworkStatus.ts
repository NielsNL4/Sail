import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [status, setStatus] = useState({ isOffline: false, networkEpoch: 0 });

  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const isOffline =
          state.isConnected === false || state.isInternetReachable === false;
        setStatus((current) =>
          current.isOffline === isOffline
            ? current
            : { isOffline, networkEpoch: current.networkEpoch + 1 },
        );
      }),
    [],
  );

  return status;
}
