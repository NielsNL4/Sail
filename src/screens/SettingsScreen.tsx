import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/stores';
import type { VesselProfile } from '@/types';
import { feetToMeters, metersToFeet, vesselProfileIsEmpty } from '@/utils';

const fields: {
  key: keyof VesselProfile;
  label: string;
  dimension: 'beam' | 'length' | null;
}[] = [
  { key: 'draftMeters', label: 'Diepgang', dimension: null },
  { key: 'airDraftMeters', label: 'Doorvaarthoogte', dimension: null },
  { key: 'beamMeters', label: 'Breedte', dimension: 'beam' },
  { key: 'lengthMeters', label: 'Lengte', dimension: 'length' },
];

const webInputStyle = {
  outlineStyle: 'none',
} as unknown as TextStyle;

function formatValue(value: number | null, unit: 'meters' | 'feet'): string {
  if (value === null) return '';
  if (unit === 'feet') return metersToFeet(value).toFixed(2);
  return String(value);
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const profile = useSettingsStore((state) => state.vesselProfile);
  const setVesselProfile = useSettingsStore((state) => state.setVesselProfile);
  const vesselDimensionUnits = useSettingsStore(
    (state) => state.vesselDimensionUnits,
  );
  const setVesselDimensionUnit = useSettingsStore(
    (state) => state.setVesselDimensionUnit,
  );
  const [draft, setDraft] = useState<VesselProfile>(profile);
  const [saved, setSaved] = useState(false);

  const setField = (
    key: keyof VesselProfile,
    text: string,
    unit: 'meters' | 'feet',
  ) => {
    const normalized = text.replace(',', '.');
    if (normalized !== '' && !/^\d*(\.\d*)?$/.test(normalized)) return;
    const displayedValue = normalized === '' ? null : Number(normalized);
    const value =
      displayedValue === null
        ? null
        : unit === 'feet'
          ? feetToMeters(displayedValue)
          : displayedValue;
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const save = () => {
    const values = Object.values(draft);
    if (
      values.some(
        (value) => value !== null && (!Number.isFinite(value) || value <= 0),
      )
    ) {
      return;
    }
    setVesselProfile(draft);
    setSaved(true);
  };

  const reset = () => {
    const empty = {
      draftMeters: null,
      airDraftMeters: null,
      beamMeters: null,
      lengthMeters: null,
    } satisfies VesselProfile;
    setDraft(empty);
    setVesselProfile(empty);
    setSaved(true);
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerBlock}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="boat-outline" size={18} color="#0e7490" />
          <Text style={styles.eyebrow}>MIJN SCHIP</Text>
        </View>
        <Text style={styles.title}>Vaar met jouw maten</Text>
        <Text style={styles.intro}>
          Vul de afmetingen van je schip in. De kaart markeert vaarwegen die op
          basis van CEMT-klasse mogelijk niet passen.
        </Text>
      </View>

      <View style={styles.card}>
        {fields.map(({ key, label, dimension }) => {
          const unit = dimension ? vesselDimensionUnits[dimension] : 'meters';
          return (
            <View key={key} style={styles.fieldRow}>
              <Text style={styles.label}>{label}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  accessibilityLabel={label}
                  keyboardType="decimal-pad"
                  onChangeText={(text) => setField(key, text, unit)}
                  style={[
                    styles.input,
                    Platform.OS === 'web' ? webInputStyle : undefined,
                  ]}
                  value={formatValue(draft[key], unit)}
                />
                {dimension ? (
                  <View style={styles.fieldUnitSwitch}>
                    {(['meters', 'feet'] as const).map((option) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: unit === option }}
                        key={option}
                        onPress={() =>
                          setVesselDimensionUnit(dimension, option)
                        }
                        style={[
                          styles.fieldUnitButton,
                          unit === option && styles.fieldUnitButtonSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.fieldUnitText,
                            unit === option && styles.fieldUnitTextSelected,
                          ]}
                        >
                          {option === 'meters' ? 'm' : 'ft'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.unit}>m</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.note}>
        <Ionicons name="information-circle-outline" size={20} color="#0e7490" />
        <Text style={styles.noteText}>
          Deze waarschuwingen zijn indicatief. Controleer altijd actuele
          vaarweggegevens, waterstanden en officiële scheepvaartberichten.
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={save}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryText}>Profiel opslaan</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={reset}
        style={styles.resetButton}
      >
        <Text style={styles.resetText}>Profiel wissen</Text>
      </Pressable>
      {saved && (
        <Text style={styles.savedText}>
          {vesselProfileIsEmpty(draft)
            ? 'Profiel gewist'
            : 'Profiel opgeslagen'}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flexGrow: 1,
    padding: 22,
    paddingBottom: 36,
    backgroundColor: '#f8fafc',
  },
  headerBlock: { maxWidth: 560, width: '100%' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: {
    color: '#0e7490',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  title: { color: '#082f49', fontSize: 32, fontWeight: '800', marginTop: 10 },
  intro: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 24,
    maxWidth: 520,
    padding: 18,
    width: '100%',
  },
  fieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
  },
  label: {
    color: '#334155',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    paddingRight: 16,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    width: 220,
  },
  input: {
    backgroundColor: 'transparent',
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
  fieldUnitSwitch: {
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    flexDirection: 'row',
    marginRight: 4,
    padding: 2,
  },
  fieldUnitButton: {
    alignItems: 'center',
    borderRadius: 6,
    minWidth: 30,
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  fieldUnitButtonSelected: { backgroundColor: '#fff' },
  fieldUnitText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  fieldUnitTextSelected: { color: '#0e7490' },
  note: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    maxWidth: 520,
    marginTop: 18,
    width: '100%',
  },
  noteText: { color: '#475569', flex: 1, fontSize: 13, lineHeight: 19 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#0e7490',
    borderRadius: 12,
    maxWidth: 520,
    marginTop: 28,
    padding: 15,
    width: '100%',
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  resetButton: {
    alignItems: 'center',
    maxWidth: 520,
    padding: 15,
    width: '100%',
  },
  resetText: { color: '#64748b', fontSize: 15, fontWeight: '700' },
  savedText: { color: '#15803d', textAlign: 'center' },
});
