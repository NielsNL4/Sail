import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_DEVELOPMENT_LOCATION,
  useDevelopmentLocationStore,
} from '@/stores';
import type { Coordinates } from '@/types';
import { isPhoneLayout } from '@/utils';

const presets: { label: string; coordinates: Coordinates }[] = [
  {
    label: 'IJsselmeer',
    coordinates: { latitude: 52.75, longitude: 5.35 },
  },
  {
    label: 'Markermeer',
    coordinates: { latitude: 52.48, longitude: 5.2 },
  },
  {
    label: 'Waddenzee',
    coordinates: { latitude: 53.18, longitude: 5.43 },
  },
];

const webInputStyle = { outlineStyle: 'none' } as unknown as TextStyle;

function parseNumber(value: string): number {
  return Number(value.replace(',', '.'));
}

export function DeveloperScreen() {
  const insets = useSafeAreaInsets();
  const phoneLayout = isPhoneLayout(useWindowDimensions().width);
  const enabled = useDevelopmentLocationStore((state) => state.enabled);
  const running = useDevelopmentLocationStore((state) => state.running);
  const currentCoordinates = useDevelopmentLocationStore(
    (state) => state.coordinates,
  );
  const setEnabled = useDevelopmentLocationStore((state) => state.setEnabled);
  const setConfiguration = useDevelopmentLocationStore(
    (state) => state.setConfiguration,
  );
  const startSimulation = useDevelopmentLocationStore((state) => state.start);
  const pauseSimulation = useDevelopmentLocationStore((state) => state.pause);
  const resetSimulation = useDevelopmentLocationStore((state) => state.reset);
  const [draft, setDraft] = useState(() => {
    const state = useDevelopmentLocationStore.getState();
    return {
      latitude: String(state.coordinates.latitude),
      longitude: String(state.coordinates.longitude),
      courseDegrees: String(state.courseDegrees),
      speedKnots: String(state.speedKnots),
      accuracyMeters: String(state.accuracyMeters),
    };
  });
  const [error, setError] = useState<string | null>(null);

  const apply = (): boolean => {
    const latitude = parseNumber(draft.latitude);
    const longitude = parseNumber(draft.longitude);
    const courseDegrees = parseNumber(draft.courseDegrees);
    const speedKnots = parseNumber(draft.speedKnots);
    const accuracyMeters = parseNumber(draft.accuracyMeters);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(courseDegrees) ||
      courseDegrees < 0 ||
      courseDegrees >= 360 ||
      !Number.isFinite(speedKnots) ||
      speedKnots < 0 ||
      !Number.isFinite(accuracyMeters) ||
      accuracyMeters <= 0
    ) {
      setError('Controleer de ingevoerde waarden en toegestane bereiken.');
      return false;
    }

    setConfiguration({
      coordinates: { latitude, longitude },
      courseDegrees,
      speedKnots,
      accuracyMeters,
    });
    setError(null);
    return true;
  };

  const reset = () => {
    resetSimulation();
    setDraft({
      latitude: String(DEFAULT_DEVELOPMENT_LOCATION.coordinates.latitude),
      longitude: String(DEFAULT_DEVELOPMENT_LOCATION.coordinates.longitude),
      courseDegrees: String(DEFAULT_DEVELOPMENT_LOCATION.courseDegrees),
      speedKnots: String(DEFAULT_DEVELOPMENT_LOCATION.speedKnots),
      accuracyMeters: String(DEFAULT_DEVELOPMENT_LOCATION.accuracyMeters),
    });
    setError(null);
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        phoneLayout && styles.contentPhone,
        { paddingTop: insets.top + (phoneLayout ? 14 : 20) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerBlock}>
        <View style={styles.eyebrowRow}>
          <Ionicons color="#b45309" name="code-slash-outline" size={18} />
          <Text style={styles.eyebrow}>DEVELOPMENT</Text>
        </View>
        <Text style={[styles.title, phoneLayout && styles.titlePhone]}>
          Vaar zonder van wal te gaan
        </Text>
        <Text style={styles.intro}>
          Simuleer een bewegende GPS-positie om navigatie en zeiladvies te
          testen. Deze functie bestaat niet in productiebuilds.
        </Text>
      </View>

      <View style={[styles.card, phoneLayout && styles.cardPhone]}>
        <View style={styles.enableRow}>
          <View style={styles.enableText}>
            <Text style={styles.cardTitle}>Locatiesimulatie</Text>
            <Text style={styles.cardDescription}>
              Vervangt de GPS van dit apparaat.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Locatiesimulatie"
            onValueChange={setEnabled}
            trackColor={{ false: '#cbd5e1', true: '#f59e0b' }}
            value={enabled}
          />
        </View>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              enabled && (running ? styles.statusRunning : styles.statusPaused),
            ]}
          />
          <Text style={styles.statusText}>
            {!enabled ? 'Uitgeschakeld' : running ? 'Varend' : 'Gepauzeerd'}
          </Text>
          <Text style={styles.currentCoordinates}>
            {currentCoordinates.latitude.toFixed(5)},{' '}
            {currentCoordinates.longitude.toFixed(5)}
          </Text>
        </View>
      </View>

      <View style={[styles.card, phoneLayout && styles.cardPhone]}>
        <Text style={styles.cardTitle}>Startpositie</Text>
        <View style={styles.presetRow}>
          {presets.map((preset) => (
            <Pressable
              accessibilityRole="button"
              key={preset.label}
              onPress={() => {
                setDraft((current) => ({
                  ...current,
                  latitude: String(preset.coordinates.latitude),
                  longitude: String(preset.coordinates.longitude),
                }));
                setError(null);
              }}
              style={styles.presetButton}
            >
              <Text style={styles.presetText}>{preset.label}</Text>
            </Pressable>
          ))}
        </View>

        {(
          [
            ['latitude', 'Breedtegraad', '°'],
            ['longitude', 'Lengtegraad', '°'],
            ['courseDegrees', 'COG', '°'],
            ['speedKnots', 'SOG', 'kn'],
            ['accuracyMeters', 'GPS-nauwkeurigheid', 'm'],
          ] as const
        ).map(([key, label, unit]) => (
          <View
            key={key}
            style={[styles.fieldRow, phoneLayout && styles.fieldRowPhone]}
          >
            <Text style={styles.label}>{label}</Text>
            <View
              style={[styles.inputWrap, phoneLayout && styles.inputWrapPhone]}
            >
              <TextInput
                accessibilityLabel={label}
                keyboardType="decimal-pad"
                onChangeText={(value) => {
                  setDraft((current) => ({ ...current, [key]: value }));
                  setError(null);
                }}
                style={[
                  styles.input,
                  Platform.OS === 'web' ? webInputStyle : undefined,
                ]}
                value={draft[key]}
              />
              <Text style={styles.unit}>{unit}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.hint}>COG: 0° tot 359°. SOG: 0 kn of hoger.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={apply}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryText}>Toepassen</Text>
        </Pressable>
        {running ? (
          <Pressable
            accessibilityRole="button"
            onPress={pauseSimulation}
            style={styles.primaryButton}
          >
            <Ionicons color="#fff" name="pause" size={18} />
            <Text style={styles.primaryText}>Pauzeer</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={!enabled}
            onPress={() => {
              if (apply()) startSimulation();
            }}
            style={[styles.primaryButton, !enabled && styles.buttonDisabled]}
          >
            <Ionicons color="#fff" name="play" size={18} />
            <Text style={styles.primaryText}>Start</Text>
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={reset}
        style={styles.resetButton}
      >
        <Text style={styles.resetText}>Herstel standaardwaarden</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    flexGrow: 1,
    padding: 22,
    paddingBottom: 36,
  },
  contentPhone: { paddingBottom: 24, paddingHorizontal: 16 },
  headerBlock: { maxWidth: 560, width: '100%' },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  eyebrow: {
    color: '#b45309',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: { color: '#451a03', fontSize: 32, fontWeight: '800', marginTop: 10 },
  titlePhone: { fontSize: 25, lineHeight: 31 },
  intro: { color: '#78350f', fontSize: 15, lineHeight: 23, marginTop: 10 },
  card: {
    backgroundColor: '#fff',
    borderColor: '#fed7aa',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 20,
    maxWidth: 520,
    padding: 18,
    width: '100%',
  },
  cardPhone: { marginTop: 16, padding: 14 },
  cardTitle: { color: '#451a03', fontSize: 17, fontWeight: '800' },
  cardDescription: { color: '#92400e', fontSize: 12, marginTop: 3 },
  enableRow: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  enableText: { flex: 1 },
  statusRow: { alignItems: 'center', flexDirection: 'row', marginTop: 18 },
  statusDot: {
    backgroundColor: '#cbd5e1',
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  statusPaused: { backgroundColor: '#f59e0b' },
  statusRunning: { backgroundColor: '#16a34a' },
  statusText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 7,
  },
  currentCoordinates: {
    color: '#64748b',
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 14,
  },
  presetButton: {
    backgroundColor: '#ffedd5',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  presetText: { color: '#9a3412', fontSize: 12, fontWeight: '800' },
  fieldRow: { alignItems: 'center', flexDirection: 'row', minHeight: 58 },
  fieldRowPhone: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 6,
    paddingVertical: 6,
  },
  label: {
    color: '#334155',
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingRight: 16,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    width: 220,
  },
  inputWrapPhone: { minHeight: 46, width: '100%' },
  input: {
    borderWidth: 0,
    color: '#0f172a',
    flex: 1,
    fontSize: 16,
    minWidth: 0,
    outlineWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 11,
    textAlign: 'right',
  },
  unit: { color: '#64748b', paddingRight: 12 },
  hint: { color: '#64748b', fontSize: 11, marginTop: 8 },
  error: { color: '#b91c1c', fontSize: 12, fontWeight: '600', marginTop: 10 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    maxWidth: 520,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#b45309',
    borderRadius: 12,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    padding: 14,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#ffedd5',
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    padding: 14,
  },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryText: { color: '#9a3412', fontSize: 15, fontWeight: '800' },
  buttonDisabled: { opacity: 0.4 },
  resetButton: { maxWidth: 520, padding: 15, width: '100%' },
  resetText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
