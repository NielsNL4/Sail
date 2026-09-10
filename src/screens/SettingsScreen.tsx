import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import type { TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettingsStore } from '@/stores';
import type { SailingProfile, VesselProfile } from '@/types';
import { feetToMeters, isPhoneLayout, metersToFeet } from '@/utils';

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
  const { width: screenWidth } = useWindowDimensions();
  const phoneLayout = isPhoneLayout(screenWidth);
  const profile = useSettingsStore((state) => state.vesselProfile);
  const setVesselProfile = useSettingsStore((state) => state.setVesselProfile);
  const sailingProfile = useSettingsStore((state) => state.sailingProfile);
  const setSailingProfile = useSettingsStore(
    (state) => state.setSailingProfile,
  );
  const vesselDimensionUnits = useSettingsStore(
    (state) => state.vesselDimensionUnits,
  );
  const setVesselDimensionUnit = useSettingsStore(
    (state) => state.setVesselDimensionUnit,
  );
  const [draft, setDraft] = useState<VesselProfile>(profile);
  const [sailingDraft, setSailingDraft] =
    useState<SailingProfile>(sailingProfile);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'reset' | null>(null);

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
    setSaveStatus(null);
  };

  const save = () => {
    const values = Object.values(draft);
    if (
      values.some(
        (value) => value !== null && (!Number.isFinite(value) || value <= 0),
      ) ||
      sailingDraft.closeHauledAngleDegrees < 35 ||
      sailingDraft.closeHauledAngleDegrees > 60
    ) {
      return;
    }
    setVesselProfile(draft);
    setSailingProfile(sailingDraft);
    setSaveStatus('saved');
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
    setSailingDraft({ closeHauledAngleDegrees: 45 });
    setSailingProfile({ closeHauledAngleDegrees: 45 });
    setSaveStatus('reset');
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
          <Ionicons name="boat-outline" size={18} color="#0e7490" />
          <Text style={styles.eyebrow}>MIJN SCHIP</Text>
        </View>
        <Text style={[styles.title, phoneLayout && styles.titlePhone]}>
          Vaar met jouw maten
        </Text>
        <Text style={[styles.intro, phoneLayout && styles.introPhone]}>
          Vul de afmetingen van je schip in. De kaart markeert vaarwegen die op
          basis van CEMT-klasse mogelijk niet passen.
        </Text>
      </View>

      <View style={[styles.card, phoneLayout && styles.cardPhone]}>
        {fields.map(({ key, label, dimension }) => {
          const unit = dimension ? vesselDimensionUnits[dimension] : 'meters';
          return (
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

      <View style={[styles.card, phoneLayout && styles.cardPhone]}>
        <View style={styles.cardHeadingRow}>
          <Ionicons color="#0e7490" name="compass-outline" size={20} />
          <View style={styles.cardHeadingText}>
            <Text style={styles.cardTitle}>Zeilgedrag</Text>
            <Text style={styles.cardDescription}>
              Hoek tot de forecastwind die je schip aan de wind kan varen.
            </Text>
          </View>
        </View>
        <View style={[styles.fieldRow, phoneLayout && styles.fieldRowPhone]}>
          <Text style={styles.label}>Aan-de-windse hoek</Text>
          <View
            style={[styles.inputWrap, phoneLayout && styles.inputWrapPhone]}
          >
            <TextInput
              accessibilityLabel="Aan-de-windse hoek"
              keyboardType="number-pad"
              onChangeText={(text) => {
                if (text !== '' && !/^\d{0,2}$/.test(text)) return;
                setSailingDraft({
                  closeHauledAngleDegrees: text === '' ? 0 : Number(text),
                });
                setSaveStatus(null);
              }}
              style={[
                styles.input,
                Platform.OS === 'web' ? webInputStyle : undefined,
              ]}
              value={
                sailingDraft.closeHauledAngleDegrees === 0
                  ? ''
                  : String(sailingDraft.closeHauledAngleDegrees)
              }
            />
            <Text style={styles.unit}>°</Text>
          </View>
        </View>
        <Text style={styles.fieldHint}>Toegestaan bereik: 35° tot 60°.</Text>
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
      {saveStatus ? (
        <Text style={styles.savedText}>
          {saveStatus === 'reset' ? 'Profiel gewist' : 'Profiel opgeslagen'}
        </Text>
      ) : null}
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
  contentPhone: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
  titlePhone: { fontSize: 25, lineHeight: 31 },
  intro: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 10,
  },
  introPhone: {
    fontSize: 14,
    lineHeight: 21,
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
  cardPhone: {
    marginTop: 18,
    padding: 14,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardHeadingText: { minWidth: 0, flex: 1 },
  cardTitle: { color: '#082f49', fontSize: 17, fontWeight: '800' },
  cardDescription: {
    marginTop: 2,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  fieldHint: { color: '#64748b', fontSize: 11, lineHeight: 16 },
  fieldRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 62,
  },
  fieldRowPhone: {
    minHeight: 0,
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 6,
    paddingVertical: 7,
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
  inputWrapPhone: {
    minHeight: 48,
    width: '100%',
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
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
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
