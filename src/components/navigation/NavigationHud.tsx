import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { instrumentStyles } from './InstrumentCell';

import type {
  GpsQuality,
  NavigationMetrics,
  NavigationStatus,
  SailingGuidance,
} from '@/types';

interface NavigationHudProps {
  compact: boolean;
  metrics: NavigationMetrics | null;
  onStop: () => void;
  sailingGuidance: SailingGuidance | null;
  status: NavigationStatus;
  targetName: string;
}

const gpsLabels: Record<GpsQuality, string> = {
  unavailable: 'GPS zoeken',
  mocked: 'Testpositie',
  stale: 'GPS verouderd',
  poor: 'GPS onnauwkeurig',
  good: 'GPS goed',
};

function number(value: number | null, digits = 1): string {
  return value === null ? '--' : value.toFixed(digits).replace('.', ',');
}

function bearing(value: number | null): string {
  return value === null
    ? '--'
    : `${Math.round(value).toString().padStart(3, '0')}°`;
}

function eta(value: string | null): string {
  if (!value) return '--';
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function forecastTime(value: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function NavigationHud({
  compact,
  metrics,
  onStop,
  sailingGuidance,
  status,
  targetName,
}: NavigationHudProps) {
  const values = [
    { label: 'COG', value: bearing(metrics?.cogDegrees ?? null) },
    { label: 'BTW', value: bearing(metrics?.bearingToWaypointDegrees ?? null) },
    {
      label: 'DTW',
      value: `${number(metrics?.distanceToWaypointNm ?? null)} nm`,
    },
    {
      label: 'VMG',
      value: `${number(metrics?.vmgToWaypointKnots ?? null)} kn`,
    },
    { label: 'ETA', value: eta(metrics?.eta ?? null) },
  ];
  const quality = metrics?.gpsQuality ?? 'unavailable';
  const statusLabel =
    status === 'arrived'
      ? 'Bestemming bereikt'
      : status === 'error'
        ? 'Navigatie onderbroken'
        : status === 'acquiring'
          ? 'GPS zoeken'
          : gpsLabels[quality];

  return (
    <View
      style={[
        instrumentStyles.panel,
        styles.container,
        compact && styles.containerCompact,
      ]}
    >
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text accessibilityLiveRegion="polite" style={styles.eyebrow}>
            {statusLabel}
          </Text>
          <Text numberOfLines={1} style={styles.target}>
            {targetName}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Stop navigatie"
          accessibilityRole="button"
          hitSlop={6}
          onPress={onStop}
          style={({ pressed }) => [
            styles.stopButton,
            pressed && styles.stopButtonPressed,
          ]}
        >
          <Ionicons color="#fee2e2" name="stop" size={17} />
          {!compact ? <Text style={styles.stopText}>Stop</Text> : null}
        </Pressable>
      </View>
      <View style={styles.values}>
        {values.map((item) => (
          <View key={item.label} style={styles.value}>
            <Text style={styles.valueLabel}>{item.label}</Text>
            <Text style={styles.valueText}>{item.value}</Text>
          </View>
        ))}
      </View>
      {status === 'navigating' ? (
        <View style={styles.sailingStrip}>
          <Text style={styles.sailingLabel}>INDICATIEF ZEILADVIES</Text>
          {!sailingGuidance ? (
            <Text style={styles.sailingMuted}>
              Forecastwind niet beschikbaar
            </Text>
          ) : sailingGuidance.quality === 'stale' ? (
            <Text style={styles.sailingWarning}>Forecastwind is verouderd</Text>
          ) : sailingGuidance.quality === 'unavailable' ? (
            <Text style={styles.sailingWarning}>
              Betrouwbare GPS-fix nodig voor zeiladvies
            </Text>
          ) : (
            <>
              <View style={styles.sailingValues}>
                <Text style={styles.sailingValue}>
                  Wind uit {bearing(sailingGuidance.windFromDegrees)} ·{' '}
                  {number(sailingGuidance.windSpeedKnots)} kn
                </Text>
                <Text style={styles.sailingValue}>
                  {sailingGuidance.currentTack === 'port'
                    ? 'Bakboordslag'
                    : sailingGuidance.currentTack === 'starboard'
                      ? 'Stuurboordslag'
                      : 'Slag --'}
                </Text>
              </View>
              <Text style={styles.sailingAngles}>
                Windhoek koers{' '}
                {bearing(sailingGuidance.relativeWindAngleToCourseDegrees)} ·
                doel{' '}
                {bearing(sailingGuidance.relativeWindAngleToWaypointDegrees)}
                {sailingGuidance.vmgToWindKnots !== null
                  ? ` · VMG wind ${number(sailingGuidance.vmgToWindKnots)} kn`
                  : ''}
              </Text>
              <Text style={styles.sailingAdvice}>
                {sailingGuidance.destinationInNoGoZone
                  ? sailingGuidance.recommendedHeadingDegrees !== null
                    ? `${sailingGuidance.recommendedTack === 'port' ? 'Bakboord' : 'Stuurboord'} indicatief ${bearing(sailingGuidance.recommendedHeadingDegrees)}`
                    : `Beide slagen gelijkwaardig: ${bearing(sailingGuidance.portTackHeadingDegrees)} / ${bearing(sailingGuidance.starboardTackHeadingDegrees)}`
                  : `Bestemming bezeild · ${bearing(sailingGuidance.recommendedHeadingDegrees)}`}
              </Text>
              <Text style={styles.sailingSource}>
                Forecastwind op 10 m · geldig{' '}
                {forecastTime(sailingGuidance.windValidAt)} · KNMI via
                Open-Meteo
              </Text>
            </>
          )}
        </View>
      ) : null}
      <Text style={styles.notice}>
        Directe lijn, geen gecontroleerde vaarroute
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 12,
  },
  containerCompact: {
    padding: 10,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headingText: { minWidth: 0, flex: 1 },
  eyebrow: {
    color: '#7dd3fc',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  target: { color: '#f0f9ff', fontSize: 16, fontWeight: '800' },
  stopButton: {
    minWidth: 40,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderRadius: 10,
    backgroundColor: '#991b1b',
  },
  stopButtonPressed: { opacity: 0.78 },
  stopText: { color: '#fee2e2', fontSize: 11, fontWeight: '800' },
  values: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 211, 252, 0.28)',
  },
  value: { minWidth: 58, flex: 1, paddingTop: 7 },
  valueLabel: { color: '#7dd3fc', fontSize: 8, fontWeight: '800' },
  valueText: { color: '#f8fafc', fontSize: 12, fontWeight: '800' },
  sailingStrip: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: 'rgba(125, 211, 252, 0.28)',
  },
  sailingLabel: {
    color: '#fdba74',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  sailingValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 3,
  },
  sailingValue: { color: '#f8fafc', fontSize: 10, fontWeight: '700' },
  sailingAngles: { marginTop: 3, color: '#bae6fd', fontSize: 9 },
  sailingAdvice: {
    marginTop: 3,
    color: '#fed7aa',
    fontSize: 11,
    fontWeight: '800',
  },
  sailingSource: { marginTop: 2, color: '#94a3b8', fontSize: 8 },
  sailingMuted: { marginTop: 3, color: '#bae6fd', fontSize: 10 },
  sailingWarning: {
    marginTop: 3,
    color: '#fcd34d',
    fontSize: 10,
    fontWeight: '700',
  },
  notice: { marginTop: 7, color: '#bae6fd', fontSize: 9 },
});
