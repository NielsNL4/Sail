import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { DeveloperScreen, MapScreen, SettingsScreen } from '@/screens';
import { useForegroundLocation } from './src/hooks/useLocation';
import {
  useDevelopmentLocationSimulation,
  useNavigationSession,
  usePersistedStoresReady,
} from '@/hooks';

type Tab = 'map' | 'settings' | 'developer';

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const storesReady = usePersistedStoresReady();
  useForegroundLocation();
  const navigation = useNavigationSession();
  useDevelopmentLocationSimulation();

  return (
    <SafeAreaProvider>
      <View style={styles.app}>
        {!storesReady ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#0e7490" size="large" />
            <Text style={styles.loadingText}>Instellingen laden...</Text>
          </View>
        ) : (
          <>
            <View style={styles.screen}>
              {tab === 'map' ? (
                <MapScreen navigation={navigation} />
              ) : tab === 'settings' || !__DEV__ ? (
                <SettingsScreen />
              ) : (
                <DeveloperScreen />
              )}
            </View>
            <SafeAreaView edges={['bottom']} style={styles.tabBarSafeArea}>
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
                {__DEV__ ? (
                  <TabButton
                    icon="code-slash-outline"
                    label="Developer"
                    onPress={() => setTab('developer')}
                    selected={tab === 'developer'}
                  />
                ) : null}
              </View>
            </SafeAreaView>
          </>
        )}
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
  loading: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  loadingText: { color: '#475569', fontSize: 14, fontWeight: '600' },
  screen: { flex: 1 },
  tabBarSafeArea: { backgroundColor: '#fff' },
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
