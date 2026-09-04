import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BaseMap,
  LayerMenu,
  regionToZoom,
  shouldRenderWindParticles,
} from '@/components/maps';
import { useDepthInspection, useLocation, useWeather } from '@/hooks';
import { strings } from '@/i18n';
import {
  useLayersStore,
  useLocationStore,
  useSettingsStore,
  useWindFieldStore,
} from '@/stores';
import type { DepthMode, MapStyleId, WindColorMode } from '@/types';
import {
  directionToCompass,
  DUTCH_WATERS_REGION,
  formatTemperature,
  formatWindSpeed,
} from '@/utils';

const mapStyles: {
  id: MapStyleId;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  {
    id: 'modern',
    label: strings.modernMapStyle,
    icon: 'navigate-circle-outline',
  },
  {
    id: 'traditional',
    label: strings.traditionalMapStyle,
    icon: 'map-outline',
  },
  { id: 'dark', label: strings.darkMapStyle, icon: 'moon-outline' },
  { id: 'satellite', label: strings.satelliteMapStyle, icon: 'image-outline' },
];

const windColorModes: { id: WindColorMode; label: string }[] = [
  { id: 'speed', label: strings.windSpeedColors },
  { id: 'contrast', label: strings.windContrastColor },
];

const depthModes: { id: DepthMode; label: string }[] = [
  { id: 'enc', label: strings.depthModeEnc },
  { id: 'bathymetry', label: strings.depthModeBathymetry },
];

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const [focusRequestId, setFocusRequestId] = useState(0);
  const depthVisible = useLayersStore((state) => state.visibility.depth);
  const windVisible = useLayersStore((state) => state.visibility.wind);
  const layerVisibility = useLayersStore((state) => state.visibility);
  const toggleLayer = useLayersStore((state) => state.toggleLayer);
  const windSpeedUnit = useSettingsStore((state) => state.windSpeedUnit);
  const temperatureUnit = useSettingsStore((state) => state.temperatureUnit);
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);
  const windColorMode = useSettingsStore((state) => state.windColorMode);
  const setWindColorMode = useSettingsStore((state) => state.setWindColorMode);
  const depthMode = useSettingsStore((state) => state.depthMode);
  const setDepthMode = useSettingsStore((state) => state.setDepthMode);
  const mapRegion = useLocationStore((state) => state.mapRegion);
  const mapZoom = useLocationStore((state) => state.mapZoom);
  const windField = useWindFieldStore((state) => state.field);
  const isWindFieldLoading = useWindFieldStore((state) => state.isLoading);
  const windFieldError = useWindFieldStore((state) => state.error);
  const {
    location,
    permissionStatus,
    isTracking,
    isMocked,
    error,
    requestLocation,
  } = useLocation();
  const weatherCoordinates = location?.coordinates ?? DUTCH_WATERS_REGION;
  const {
    weather,
    isLoading: isWeatherLoading,
    error: weatherError,
  } = useWeather(weatherCoordinates, windVisible);
  const windSpeed = weather
    ? formatWindSpeed(weather.current.wind.speedMetersPerSecond, windSpeedUnit)
    : null;
  const windDirection = weather
    ? directionToCompass(weather.current.wind.directionDegrees)
    : null;
  const temperature = weather
    ? formatTemperature(weather.current.temperatureCelsius, temperatureUnit)
    : null;
  const effectiveMapZoom =
    mapZoom ?? regionToZoom(mapRegion ?? DUTCH_WATERS_REGION);
  const windAnimationAvailable = shouldRenderWindParticles(effectiveMapZoom);
  const {
    selectedSample,
    isInspecting,
    inspectionError,
    inspectDepth,
    clearDepthInspection,
  } = useDepthInspection();

  const handleLocatePress = async () => {
    const nextLocation = await requestLocation();

    if (nextLocation) {
      setFocusRequestId((requestId) => requestId + 1);
    }
  };

  const locationTitle = isMocked
    ? strings.developmentLocation
    : strings.currentLocation;
  const statusMessage = error
    ? error
    : isMocked
      ? strings.developmentLocationDetails
      : permissionStatus === 'undetermined'
        ? strings.locationRationale
        : null;
  const layerPanelTop = insets.top + (isMocked ? 68 : 14);
  const layerPanelWidth = Math.min(380, screenWidth - 28);
  const layerPanelMaxHeight = Math.max(
    240,
    screenHeight - layerPanelTop - insets.bottom - 92,
  );

  return (
    <View style={styles.container}>
      <BaseMap
        depthMode={depthMode}
        focusRequestId={focusRequestId}
        initialRegion={DUTCH_WATERS_REGION}
        location={location}
        locationTitle={locationTitle}
        onDepthPress={inspectDepth}
      />

      <ScrollView
        contentContainerStyle={styles.layerPanelContent}
        showsVerticalScrollIndicator={false}
        style={[
          styles.layerPanel,
          {
            top: layerPanelTop,
            width: layerPanelWidth,
            maxHeight: layerPanelMaxHeight,
          },
        ]}
      >
        <LayerMenu
          onToggle={(layer) => {
            if (layer === 'depth' && depthVisible) {
              clearDepthInspection();
            }
            toggleLayer(layer);
          }}
          visibility={layerVisibility}
        />

        <View style={styles.mapStyleSection}>
          <Text style={styles.mapStyleTitle}>{strings.mapStyle}</Text>
          <View style={styles.mapStyleButtons}>
            {mapStyles.map((style) => {
              const selected = style.id === mapStyle;

              return (
                <Pressable
                  accessibilityLabel={`${strings.mapStyle}: ${style.label}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={style.id}
                  onPress={() => setMapStyle(style.id)}
                  style={({ pressed }) => [
                    styles.mapStyleButton,
                    selected && styles.mapStyleButtonSelected,
                    pressed && styles.layerButtonPressed,
                  ]}
                >
                  <Ionicons
                    color={selected ? '#f0f9ff' : '#0c4a6e'}
                    name={style.icon}
                    size={16}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.mapStyleButtonText,
                      selected && styles.layerButtonTextSelected,
                    ]}
                  >
                    {style.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {windVisible ? (
          <View style={styles.windReadout}>
            <View style={styles.windColorModes}>
              {windColorModes.map((mode) => {
                const selected = mode.id === windColorMode;

                return (
                  <Pressable
                    accessibilityLabel={`${strings.windColors}: ${mode.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={mode.id}
                    onPress={() => setWindColorMode(mode.id)}
                    style={({ pressed }) => [
                      styles.windColorModeButton,
                      selected && styles.windColorModeButtonSelected,
                      pressed && styles.layerButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.windColorModeText,
                        selected && styles.windColorModeTextSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {isWeatherLoading && !weather ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0c4a6e" size="small" />
                <Text style={styles.weatherMuted}>
                  {strings.weatherLoading}
                </Text>
              </View>
            ) : weather ? (
              <>
                <View style={styles.windValueRow}>
                  <Text style={styles.windValue}>{windSpeed}</Text>
                  <Text style={styles.windDirection}>{windDirection}</Text>
                  {temperature ? (
                    <Text style={styles.temperature}>{temperature}</Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => Linking.openURL('https://open-meteo.com/')}
                >
                  <Text style={styles.weatherSource}>
                    {strings.weatherSource}
                    {weather.isCached ? ` · ${strings.cachedData}` : ''}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.weatherError}>
                {weatherError ?? strings.weatherUnavailable}
              </Text>
            )}
            {!windAnimationAvailable ? (
              <Text style={styles.windAnimationStatus}>
                {strings.windZoomIn}
              </Text>
            ) : isWindFieldLoading && !windField ? (
              <Text style={styles.windAnimationStatus}>
                {strings.windFieldLoading}
              </Text>
            ) : windFieldError ? (
              <Text style={styles.windAnimationError}>
                {windField
                  ? strings.windFieldStale
                  : strings.windFieldUnavailable}
              </Text>
            ) : null}
          </View>
        ) : null}

        {depthVisible ? (
          <View style={styles.depthPanel}>
            <View style={styles.depthModes}>
              {depthModes.map((mode) => {
                const selected = mode.id === depthMode;

                return (
                  <Pressable
                    accessibilityLabel={`${strings.depthMode}: ${mode.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={mode.id}
                    onPress={() => {
                      clearDepthInspection();
                      setDepthMode(mode.id);
                    }}
                    style={({ pressed }) => [
                      styles.depthModeButton,
                      selected && styles.depthModeButtonSelected,
                      pressed && styles.layerButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.depthModeText,
                        selected && styles.depthModeTextSelected,
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.depthSource}>
              {depthMode === 'enc'
                ? strings.depthSourceEnc
                : strings.depthSourceBathymetry}
            </Text>
            {effectiveMapZoom < 8 ? (
              <Text style={styles.depthStatus}>{strings.depthZoomIn}</Text>
            ) : null}
            {depthMode === 'bathymetry' && isInspecting ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#0c4a6e" size="small" />
                <Text style={styles.depthStatus}>
                  {strings.depthInspecting}
                </Text>
              </View>
            ) : depthMode === 'bathymetry' && selectedSample ? (
              <>
                <Text style={styles.selectedDepth}>
                  {strings.depthSelected(
                    selectedSample.bottomElevationMetersNap
                      .toFixed(1)
                      .replace('.', ','),
                  )}
                </Text>
                <Text style={styles.selectedDepthPosition}>
                  {strings.depthSelectedPosition(
                    selectedSample.coordinates.latitude,
                    selectedSample.coordinates.longitude,
                  )}
                </Text>
              </>
            ) : depthMode === 'bathymetry' && inspectionError ? (
              <Text style={styles.depthError}>{inspectionError}</Text>
            ) : depthMode === 'bathymetry' && effectiveMapZoom >= 8 ? (
              <Text style={styles.depthStatus}>{strings.depthTapHint}</Text>
            ) : null}
            <Text style={styles.bathymetryNotice}>
              {depthMode === 'enc'
                ? strings.encNotice
                : strings.bathymetryNotice}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {isMocked ? (
        <View
          pointerEvents="none"
          style={[styles.mockBadge, { top: insets.top + 14 }]}
        >
          <Text style={styles.mockBadgeText}>
            {strings.developmentLocation}
          </Text>
        </View>
      ) : null}

      {statusMessage ? (
        <View
          pointerEvents="none"
          style={[styles.statusCard, { bottom: insets.bottom + 90 }]}
        >
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityLabel={strings.requestLocation}
        accessibilityRole="button"
        disabled={isTracking}
        onPress={handleLocatePress}
        style={({ pressed }) => [
          styles.locationButton,
          { bottom: insets.bottom + 24 },
          pressed && styles.locationButtonPressed,
          isTracking && styles.locationButtonDisabled,
        ]}
      >
        {isTracking ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Ionicons color="#ffffff" name="locate" size={27} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#bae6fd',
  },
  mockBadge: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#fbbf24',
    shadowColor: '#422006',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  layerPanel: {
    position: 'absolute',
    left: 14,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: 'rgba(186, 230, 253, 0.9)',
    borderRadius: 16,
    backgroundColor: 'rgba(240, 249, 255, 0.95)',
    shadowColor: '#082f49',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 7,
    elevation: 5,
  },
  layerPanelContent: {
    overflow: 'hidden',
    borderRadius: 15,
  },
  layerButtonPressed: {
    opacity: 0.76,
  },
  layerButtonText: {
    color: '#0c4a6e',
    fontSize: 13,
    fontWeight: '700',
  },
  layerButtonTextSelected: {
    color: '#f0f9ff',
  },
  mapStyleSection: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
  },
  mapStyleTitle: {
    paddingVertical: 6,
    color: '#475569',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mapStyleButtons: {
    flexDirection: 'row',
    gap: 5,
  },
  mapStyleButton: {
    minWidth: 0,
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
    borderRadius: 9,
    backgroundColor: '#e0f2fe',
  },
  mapStyleButtonSelected: {
    backgroundColor: '#0369a1',
  },
  mapStyleButtonText: {
    color: '#0c4a6e',
    fontSize: 9,
    fontWeight: '700',
  },
  windReadout: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
  },
  windColorModes: {
    flexDirection: 'row',
    gap: 5,
    paddingVertical: 7,
  },
  windColorModeButton: {
    minHeight: 28,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
  },
  windColorModeButtonSelected: {
    borderColor: '#0369a1',
    backgroundColor: '#0369a1',
  },
  windColorModeText: {
    color: '#075985',
    fontSize: 10,
    fontWeight: '700',
  },
  windColorModeTextSelected: {
    color: '#f0f9ff',
  },
  windValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  windValue: {
    color: '#082f49',
    fontSize: 22,
    fontWeight: '800',
  },
  windDirection: {
    color: '#0369a1',
    fontSize: 16,
    fontWeight: '800',
  },
  temperature: {
    marginLeft: 'auto',
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  weatherSource: {
    marginTop: 2,
    color: '#0369a1',
    fontSize: 11,
    textDecorationLine: 'underline',
  },
  loadingRow: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weatherMuted: {
    color: '#475569',
    fontSize: 12,
  },
  weatherError: {
    paddingTop: 8,
    color: '#b91c1c',
    fontSize: 12,
    lineHeight: 17,
  },
  windAnimationStatus: {
    marginTop: 6,
    color: '#475569',
    fontSize: 11,
    lineHeight: 15,
  },
  windAnimationError: {
    marginTop: 6,
    color: '#b45309',
    fontSize: 11,
    lineHeight: 15,
  },
  depthPanel: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
  },
  depthModes: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 7,
  },
  depthModeButton: {
    minHeight: 30,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1,
    borderColor: '#7dd3fc',
    borderRadius: 8,
    backgroundColor: '#f0f9ff',
  },
  depthModeButtonSelected: {
    borderColor: '#0369a1',
    backgroundColor: '#0369a1',
  },
  depthModeText: {
    color: '#075985',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  depthModeTextSelected: {
    color: '#f0f9ff',
  },
  depthSource: {
    marginBottom: 5,
    color: '#075985',
    fontSize: 10,
    fontWeight: '700',
  },
  depthStatus: {
    color: '#475569',
    fontSize: 10,
    lineHeight: 14,
  },
  selectedDepth: {
    marginTop: 4,
    color: '#082f49',
    fontSize: 13,
    fontWeight: '800',
  },
  selectedDepthPosition: {
    color: '#475569',
    fontSize: 10,
  },
  depthError: {
    color: '#b45309',
    fontSize: 10,
    lineHeight: 14,
  },
  bathymetryNotice: {
    marginTop: 4,
    color: '#334155',
    fontSize: 11,
    lineHeight: 15,
  },
  mockBadgeText: {
    color: '#422006',
    fontSize: 14,
    fontWeight: '800',
  },
  statusCard: {
    position: 'absolute',
    left: 16,
    right: 86,
    zIndex: 1000,
    maxWidth: 440,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(8, 47, 73, 0.92)',
  },
  statusText: {
    color: '#f0f9ff',
    fontSize: 14,
    lineHeight: 20,
  },
  locationButton: {
    position: 'absolute',
    right: 18,
    zIndex: 1000,
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#0369a1',
    shadowColor: '#082f49',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  locationButtonPressed: {
    backgroundColor: '#075985',
    transform: [{ scale: 0.96 }],
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
});
