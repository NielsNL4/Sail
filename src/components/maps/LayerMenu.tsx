import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/i18n';
import type { LayerId } from '@/stores';

interface LayerMenuProps {
  visibility: Record<LayerId, boolean>;
  onToggle: (layer: LayerId) => void;
}

interface LayerDefinition {
  id: LayerId;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  available: boolean;
  disabledReason?: string;
}

const layers: LayerDefinition[] = [
  {
    id: 'wind',
    icon: 'navigate-outline',
    label: strings.windLayer,
    available: true,
  },
  {
    id: 'depth',
    icon: 'water-outline',
    label: strings.bathymetryLayer,
    available: true,
  },
  {
    id: 'vessels',
    icon: 'boat-outline',
    label: strings.vesselsLayer,
    available: true,
  },
  {
    id: 'fairway',
    icon: 'git-branch-outline',
    label: strings.fairwayLayer,
    available: true,
  },
  {
    id: 'buoys',
    icon: 'radio-button-on-outline',
    label: strings.markersLayer,
    available: true,
  },
  {
    id: 'bridgesLocks',
    icon: 'business-outline',
    label: strings.bridgesLocksLayer,
    available: true,
  },
  {
    id: 'tides',
    icon: 'pulse-outline',
    label: strings.tidesLayer,
    available: false,
  },
  {
    id: 'waypoints',
    icon: 'flag-outline',
    label: strings.waypointsLayer,
    available: false,
  },
  {
    id: 'weatherWarnings',
    icon: 'warning-outline',
    label: strings.weatherWarningsLayer,
    available: false,
  },
];

export function LayerMenu({ visibility, onToggle }: LayerMenuProps) {
  return (
    <View accessibilityLabel={strings.layerMenu} style={styles.container}>
      <Text style={styles.title}>{strings.layerMenu}</Text>
      <View style={styles.grid}>
        {layers.map((layer) => {
          const selected = layer.available && visibility[layer.id];

          return (
            <Pressable
              accessibilityLabel={
                layer.available
                  ? layer.label
                  : `${layer.label}: ${
                      layer.disabledReason ?? strings.layerComingSoon
                    }`
              }
              accessibilityRole="button"
              accessibilityState={{ disabled: !layer.available, selected }}
              disabled={!layer.available}
              key={layer.id}
              onPress={() => onToggle(layer.id)}
              style={({ pressed }) => [
                styles.button,
                selected && styles.buttonSelected,
                !layer.available && styles.buttonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons
                color={selected ? '#f0f9ff' : '#0c4a6e'}
                name={layer.icon}
                size={17}
              />
              <Text
                style={[
                  styles.buttonText,
                  selected && styles.buttonTextSelected,
                  !layer.available && styles.buttonTextDisabled,
                ]}
              >
                {layer.label}
              </Text>
              {!layer.available ? (
                <Text style={styles.comingSoon}>
                  {layer.disabledReason ?? strings.layerSoonShort}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  title: {
    paddingHorizontal: 4,
    paddingBottom: 6,
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  button: {
    minWidth: 0,
    minHeight: 56,
    flexBasis: '48%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
  },
  buttonSelected: {
    backgroundColor: '#0369a1',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.76,
  },
  buttonText: {
    color: '#0c4a6e',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 15,
    textAlign: 'center',
  },
  buttonTextSelected: {
    color: '#f0f9ff',
  },
  buttonTextDisabled: {
    color: '#475569',
  },
  comingSoon: {
    color: '#64748b',
    fontSize: 8,
    lineHeight: 11,
    textAlign: 'center',
  },
});
