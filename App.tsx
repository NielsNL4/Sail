import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { MapScreen, SettingsScreen } from '@/screens';

type Tab = 'map' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('map');

  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        <View style={styles.screen}>
          {tab === 'map' ? <MapScreen /> : <SettingsScreen />}
        </View>
        <View style={styles.tabBar}>
          <TabButton
            icon="map-outline"
            label="Kaart"
            onPress={() => setTab('map')}
            selected={tab === 'map'}
          />
          <TabButton
            icon="boat-outline"
            label="Mijn schip"
            onPress={() => setTab('settings')}
            selected={tab === 'settings'}
          />
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

function TabButton({
  icon,
  label,
  onPress,
  selected,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.tabButton}
    >
      <Ionicons
        color={selected ? '#0e7490' : '#64748b'}
        name={icon}
        size={22}
      />
      <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: { backgroundColor: '#f8fafc', flex: 1 },
  screen: { flex: 1 },
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#e2e8f0',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabButton: { alignItems: 'center', flex: 1, gap: 3, paddingVertical: 4 },
  tabLabel: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  tabLabelSelected: { color: '#0e7490' },
});
