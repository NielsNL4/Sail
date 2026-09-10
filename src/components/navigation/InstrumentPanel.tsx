import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { LocationData } from '../../types';
import { calculateOwnMotion } from '../../utils/ownMotion';
import { InstrumentCell, instrumentStyles } from './InstrumentCell';

const gpsLabels = {
  good: 'GPS goed',
  unavailable: 'GPS zoeken',
  stale: 'GPS verouderd',
  poor: 'GPS onnauwkeurig',
  mocked: 'Testpositie',
};

export function InstrumentPanel({
  location,
}: {
  location: LocationData | null;
}) {
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => {
    // Expire a fix even when the location provider stops sending updates.
    const interval = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const { sogKnots, gpsQuality } = calculateOwnMotion(location, nowMs);
  const speed =
    sogKnots === null ? '--' : sogKnots.toFixed(1).replace('.', ',');
  const development =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    location?.source === 'development';
  const status = `${development ? 'DEV - ' : ''}${gpsLabels[gpsQuality]}`;

  return (
    <View
      accessible
      accessibilityLabel={`Snelheid over de grond: ${sogKnots === null ? 'niet beschikbaar' : `${speed} knopen`}. ${status}`}
      style={[instrumentStyles.panel, styles.container]}
    >
      <InstrumentCell label="SOG" value={speed} unit="kn" />
      <Text
        style={[
          styles.status,
          (development || gpsQuality !== 'good') && styles.warning,
        ]}
      >
        {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: 124, paddingHorizontal: 10, paddingVertical: 7 },
  status: { color: '#7dd3fc', fontSize: 9, fontWeight: '700' },
  warning: { color: '#fcd34d' },
});
