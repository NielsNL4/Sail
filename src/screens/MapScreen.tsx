import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
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
  type CalloutRow,
  LayerMenu,
  type MapPressPoint,
  SelectedObjectCallout,
  regionToZoom,
  shouldRenderWindParticles,
} from '@/components/maps';
import {
  useDepthInspection,
  useAIS,
  useNavigationData,
  useLocation,
  useNetworkStatus,
  useWeather,
  windFieldContainsRegion,
} from '@/hooks';
import { strings } from '@/i18n';
import {
  useLayersStore,
  useAISStore,
  useNavigationStore,
  useLocationStore,
  useSettingsStore,
  useWindFieldStore,
} from '@/stores';
import { bridgeLockService } from '@/services/BridgeLockService';
import type {
  BridgeLock,
  Coordinates,
  DepthMode,
  MapStyleId,
  WindColorMode,
} from '@/types';
import {
  directionToCompass,
  DUTCH_WATERS_REGION,
  formatDataTimestamp,
  formatTemperature,
  formatWindSpeed,
  isPhoneLayout,
  isTimestampStale,
  MIN_MARKER_ZOOM,
  shipTypeLabel,
  WEATHER_FRESHNESS_MS,
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

type ActiveMapSelection = {
  coordinates: Coordinates;
  kind: 'vessel' | 'fairway' | 'marker' | 'bridge' | 'depth';
  point: MapPressPoint;
};

interface CalloutContent {
  accentColor: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  rows: CalloutRow[];
  title: string;
}

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const phoneLayout = isPhoneLayout(screenWidth);
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const { isOffline, networkEpoch } = useNetworkStatus();
  const [focusRequestId, setFocusRequestId] = useState(0);
  const depthVisible = useLayersStore((state) => state.visibility.depth);
  const windVisible = useLayersStore((state) => state.visibility.wind);
  const vesselsVisible = useLayersStore((state) => state.visibility.vessels);
  const fairwaysVisible = useLayersStore((state) => state.visibility.fairway);
  const markersVisible = useLayersStore((state) => state.visibility.buoys);
  const bridgesVisible = useLayersStore(
    (state) => state.visibility.bridgesLocks,
  );
  const layerVisibility = useLayersStore((state) => state.visibility);
  const toggleLayer = useLayersStore((state) => state.toggleLayer);
  const windSpeedUnit = useSettingsStore((state) => state.windSpeedUnit);
  const temperatureUnit = useSettingsStore((state) => state.temperatureUnit);
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const setMapStyle = useSettingsStore((state) => state.setMapStyle);
  const windColorMode = useSettingsStore((state) => state.windColorMode);
  const setWindColorMode = useSettingsStore((state) => state.setWindColorMode);
  const depthMode = useSettingsStore((state) => state.depthMode);
  const vesselProfile = useSettingsStore((state) => state.vesselProfile);
  const setDepthMode = useSettingsStore((state) => state.setDepthMode);
  const mapRegion = useLocationStore((state) => state.mapRegion);
  const mapZoom = useLocationStore((state) => state.mapZoom);
  const windField = useWindFieldStore((state) => state.field);
  const isWindFieldLoading = useWindFieldStore((state) => state.isLoading);
  const windFieldError = useWindFieldStore((state) => state.error);
  const vesselsByMmsi = useAISStore((state) => state.vessels);
  const aisStatus = useAISStore((state) => state.connectionStatus);
  const aisError = useAISStore((state) => state.error);
  const fairwaysById = useNavigationStore((state) => state.fairways);
  const markersById = useNavigationStore((state) => state.markers);
  const fairwayError = useNavigationStore((state) => state.errors.fairways);
  const markersError = useNavigationStore((state) => state.errors.markers);
  const [selectedVesselMmsi, setSelectedVesselMmsi] = useState<string | null>(
    null,
  );
  const [selectedFairwayId, setSelectedFairwayId] = useState<string | null>(
    null,
  );
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(null);
  const [activeMapSelection, setActiveMapSelection] =
    useState<ActiveMapSelection | null>(null);
  const [calloutClosing, setCalloutClosing] = useState(false);
  const [bridges, setBridges] = useState<BridgeLock[]>([]);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
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
  } = useWeather(weatherCoordinates, windVisible, !isOffline);
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
  const markersAvailableAtZoom = effectiveMapZoom >= MIN_MARKER_ZOOM;
  const windAnimationAvailable = shouldRenderWindParticles(effectiveMapZoom);
  const {
    selectedSample,
    isInspecting,
    inspectionError,
    inspectDepth,
    clearDepthInspection,
  } = useDepthInspection(!isOffline, networkEpoch);
  const weatherIsStale = weather
    ? isTimestampStale(weather.fetchedAt, WEATHER_FRESHNESS_MS) ||
      Boolean(weatherError)
    : false;
  const activeMapRegion = mapRegion ?? DUTCH_WATERS_REGION;
  useAIS(activeMapRegion, vesselsVisible && !isOffline);
  useEffect(() => {
    if (!bridgesVisible || isOffline) return;
    let cancelled = false;
    const load = async () => {
      try {
        const nextBridges = await bridgeLockService.getStructures({
          region: activeMapRegion,
        });
        if (!cancelled) {
          setBridges(nextBridges);
          setBridgeError(null);
        }
      } catch {
        if (!cancelled) setBridgeError(bridgeLockService.unavailableReason);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 180_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeMapRegion, bridgesVisible, isOffline]);
  const { loading: fairwaysLoading } = useNavigationData(
    activeMapRegion,
    'fairways',
    fairwaysVisible,
    !isOffline,
  );
  const { loading: markersLoading } = useNavigationData(
    activeMapRegion,
    'markers',
    markersVisible && markersAvailableAtZoom,
    !isOffline,
  );
  const fairways = Object.values(fairwaysById);
  const markers = Object.values(markersById);
  const vessels = Object.values(vesselsByMmsi);
  const selectedVessel = selectedVesselMmsi
    ? (vesselsByMmsi[selectedVesselMmsi] ?? null)
    : null;
  const selectedFairway = selectedFairwayId
    ? (fairways.find((fairway) => fairway.id === selectedFairwayId) ?? null)
    : null;
  const selectedMarker = selectedMarkerId
    ? (markers.find((marker) => marker.id === selectedMarkerId) ?? null)
    : null;
  const selectedBridge = selectedBridgeId
    ? (bridges.find((bridge) => bridge.id === selectedBridgeId) ?? null)
    : null;
  const windFieldAvailableOffline = Boolean(
    windField && windFieldContainsRegion(windField, activeMapRegion),
  );

  const handleLocatePress = async () => {
    const nextLocation = await requestLocation();

    if (nextLocation) {
      setFocusRequestId((requestId) => requestId + 1);
    }
  };

  const handleVesselPress = (
    mmsi: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => {
    setCalloutClosing(false);
    setSelectedVesselMmsi(mmsi);
    setActiveMapSelection({
      coordinates: vesselsByMmsi[mmsi]?.coordinates ?? coordinates,
      kind: 'vessel',
      point,
    });
  };

  const handleFairwayPress = (
    id: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => {
    setCalloutClosing(false);
    setSelectedFairwayId(id);
    setActiveMapSelection({ coordinates, kind: 'fairway', point });
  };

  const handleMarkerPress = (
    id: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => {
    setCalloutClosing(false);
    setSelectedMarkerId(id);
    setActiveMapSelection({
      coordinates: markersById[id]?.position ?? coordinates,
      kind: 'marker',
      point,
    });
  };

  const handleBridgePress = (
    id: string,
    point: MapPressPoint,
    coordinates: Coordinates,
  ) => {
    setCalloutClosing(false);
    setSelectedBridgeId(id);
    setActiveMapSelection({
      coordinates:
        bridges.find((bridge) => bridge.id === id)?.position ?? coordinates,
      kind: 'bridge',
      point,
    });
  };

  const handleDepthPress = (
    coordinates: Parameters<typeof inspectDepth>[0],
    zoom: number,
    point: MapPressPoint,
  ) => {
    setCalloutClosing(false);
    setActiveMapSelection({ coordinates, kind: 'depth', point });
    void inspectDepth(coordinates, zoom);
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
    0,
    screenHeight - layerPanelTop - insets.bottom - 92,
  );
  const activeLayerCount = [
    windVisible,
    depthVisible,
    vesselsVisible,
    fairwaysVisible,
    markersVisible,
    bridgesVisible,
  ].filter(Boolean).length;
  const calloutAnchor = activeMapSelection
    ? activeMapSelection.kind === 'vessel' && selectedVessel
      ? selectedVessel.coordinates
      : activeMapSelection.kind === 'marker' && selectedMarker
        ? selectedMarker.position
        : activeMapSelection.kind === 'bridge' && selectedBridge
          ? selectedBridge.position
          : activeMapSelection.coordinates
    : null;
  const calloutIsOnScreen = Boolean(
    activeMapSelection &&
    activeMapSelection.point.x >= 0 &&
    activeMapSelection.point.x <= screenWidth &&
    activeMapSelection.point.y >= 0 &&
    activeMapSelection.point.y <= screenHeight,
  );
  const calloutLayerIsVisible = Boolean(
    activeMapSelection &&
    (activeMapSelection.kind !== 'marker' ||
      (markersVisible && markersAvailableAtZoom)),
  );
  const calloutKey = activeMapSelection
    ? activeMapSelection.kind === 'vessel'
      ? `vessel-${selectedVesselMmsi}`
      : activeMapSelection.kind === 'fairway'
        ? `fairway-${selectedFairwayId}`
        : activeMapSelection.kind === 'marker'
          ? `marker-${selectedMarkerId}`
          : activeMapSelection.kind === 'bridge'
            ? `bridge-${selectedBridgeId}`
            : `depth-${activeMapSelection.coordinates.latitude}-${activeMapSelection.coordinates.longitude}`
    : 'none';
  let calloutContent: CalloutContent | null = null;

  if (activeMapSelection?.kind === 'vessel' && selectedVessel) {
    const rows: CalloutRow[] = [{ label: 'MMSI', value: selectedVessel.mmsi }];
    if (selectedVessel.speedKnots !== null) {
      rows.push({
        label: 'Snelheid',
        value: `${selectedVessel.speedKnots.toFixed(1).replace('.', ',')} kn`,
      });
    }
    if (selectedVessel.courseDegrees !== null) {
      rows.push({
        label: 'Koers',
        value: `${Math.round(selectedVessel.courseDegrees)}°`,
      });
    }
    const shipType = shipTypeLabel(selectedVessel.shipType);
    if (shipType) rows.push({ label: 'Type', value: shipType });
    calloutContent = {
      accentColor: '#0284c7',
      icon: 'boat-outline',
      label: strings.vesselCallout,
      rows,
      title: selectedVessel.name ?? strings.aisVesselUnknown,
    };
  } else if (activeMapSelection?.kind === 'fairway' && selectedFairway) {
    const rows: CalloutRow[] = [
      {
        label: 'Klasse',
        value:
          selectedFairway.cemtClass === 'unknown'
            ? strings.fairwayUnknown
            : `CEMT ${selectedFairway.cemtClass}`,
      },
    ];
    if (selectedFairway.description) {
      rows.push({ label: 'Informatie', value: selectedFairway.description });
    }
    calloutContent = {
      accentColor: '#0e7490',
      icon: 'navigate-outline',
      label: strings.fairwayCallout,
      rows,
      title: selectedFairway.name ?? strings.fairwayUnknown,
    };
  } else if (activeMapSelection?.kind === 'marker' && selectedMarker) {
    const rows: CalloutRow[] = [];
    if (selectedMarker.number) {
      rows.push({ label: 'Nummer', value: selectedMarker.number });
    }
    if (selectedMarker.waterway) {
      rows.push({ label: 'Vaarwater', value: selectedMarker.waterway });
    }
    if (selectedMarker.color) {
      rows.push({
        label: 'Kleur',
        value: selectedMarker.colorPattern
          ? `${selectedMarker.color} · ${selectedMarker.colorPattern}`
          : selectedMarker.color,
      });
    }
    if (selectedMarker.description) {
      rows.push({ label: 'Informatie', value: selectedMarker.description });
    }
    calloutContent = {
      accentColor: selectedMarker.type === 'buoy' ? '#ea580c' : '#ca8a04',
      icon:
        selectedMarker.type === 'buoy' ? 'radio-button-on' : 'diamond-outline',
      label:
        selectedMarker.type === 'buoy'
          ? strings.buoyCallout
          : strings.beaconCallout,
      rows,
      title: selectedMarker.name ?? strings.markerUnknown,
    };
  } else if (activeMapSelection?.kind === 'bridge' && selectedBridge) {
    const rows: CalloutRow[] = [
      {
        label: 'Status',
        value:
          selectedBridge.liveStatus === 'open'
            ? 'Live open'
            : selectedBridge.liveStatus === 'closed'
              ? 'Gesloten'
              : 'Onbekend',
      },
    ];
    if (selectedBridge.vhfChannel) {
      rows.push({ label: 'Marifoon', value: selectedBridge.vhfChannel });
    }
    if (selectedBridge.clearanceHeightMeters !== null) {
      rows.push({
        label: 'Doorvaart',
        value: `${selectedBridge.clearanceHeightMeters.toFixed(1).replace('.', ',')} m hoog`,
      });
    }
    if (selectedBridge.scheduledOperatingTimes) {
      rows.push({
        label: 'Bediening',
        value: selectedBridge.scheduledOperatingTimes,
      });
    }
    calloutContent = {
      accentColor: selectedBridge.liveStatus === 'open' ? '#16a34a' : '#475569',
      icon:
        selectedBridge.kind === 'bridge'
          ? 'git-compare-outline'
          : 'swap-vertical-outline',
      label:
        selectedBridge.kind === 'bridge'
          ? strings.bridgeCallout
          : strings.lockCallout,
      rows,
      title: selectedBridge.name,
    };
  } else if (activeMapSelection?.kind === 'depth') {
    const rows: CalloutRow[] = [];
    if (selectedSample) {
      rows.push({
        label: 'Hoogte',
        value: `${selectedSample.bottomElevationMetersNap.toFixed(1).replace('.', ',')} m NAP`,
      });
      rows.push({
        label: 'Positie',
        value: strings.depthSelectedPosition(
          selectedSample.coordinates.latitude,
          selectedSample.coordinates.longitude,
        ),
      });
    } else {
      rows.push({
        label: 'Status',
        value: isInspecting
          ? strings.depthInspecting
          : (inspectionError ?? strings.depthPointUnavailable),
      });
    }
    calloutContent = {
      accentColor: '#0891b2',
      icon: 'water-outline',
      label: strings.depthCallout,
      rows,
      title: 'Bodemhoogte t.o.v. NAP',
    };
  }

  useEffect(() => {
    if (!phoneLayout || !layerMenuOpen || typeof document === 'undefined') {
      return;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLayerMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [layerMenuOpen, phoneLayout]);

  return (
    <View style={styles.container}>
      <BaseMap
        calloutAnchor={calloutAnchor}
        depthMode={depthMode}
        depthVisible={depthVisible}
        focusRequestId={focusRequestId}
        initialRegion={DUTCH_WATERS_REGION}
        location={location}
        locationTitle={locationTitle}
        mapStyle={mapStyle}
        networkAvailable={!isOffline}
        onCalloutPointChange={(point) => {
          if (!point) return;
          setActiveMapSelection((selection) =>
            selection ? { ...selection, point } : null,
          );
        }}
        onDepthPress={handleDepthPress}
        onMapPress={() => setCalloutClosing(true)}
        onVesselPress={handleVesselPress}
        vessels={vessels}
        vesselsVisible={vesselsVisible}
        fairways={fairways}
        fairwaysVisible={fairwaysVisible}
        markers={markers}
        markersVisible={markersVisible && markersAvailableAtZoom}
        onFairwayPress={handleFairwayPress}
        onMarkerPress={handleMarkerPress}
        bridges={bridges}
        bridgesVisible={bridgesVisible}
        onBridgePress={handleBridgePress}
        vesselProfile={vesselProfile}
        windColorMode={windColorMode}
        windVisible={windVisible}
      />

      {activeMapSelection &&
      calloutContent &&
      calloutIsOnScreen &&
      !layerMenuOpen ? (
        <SelectedObjectCallout
          {...calloutContent}
          closing={calloutClosing || !calloutLayerIsVisible}
          key={calloutKey}
          onClosed={() => {
            setActiveMapSelection(null);
            setCalloutClosing(false);
          }}
          onDismiss={() => setCalloutClosing(true)}
          point={activeMapSelection.point}
          safeBottom={insets.bottom}
          safeTop={insets.top}
          screenHeight={screenHeight}
          screenWidth={screenWidth}
        />
      ) : null}

      {phoneLayout && !layerMenuOpen ? (
        <Pressable
          accessibilityLabel={strings.openLayerMenu}
          accessibilityRole="button"
          onPress={() => setLayerMenuOpen(true)}
          style={({ pressed }) => [
            styles.layerMenuTrigger,
            { top: layerPanelTop },
            pressed && styles.layerButtonPressed,
          ]}
        >
          <Ionicons color="#f0f9ff" name="layers-outline" size={20} />
          <Text style={styles.layerMenuTriggerText}>{strings.layerMenu}</Text>
          <View style={styles.layerCountBadge}>
            <Text style={styles.layerCountText}>{activeLayerCount}</Text>
          </View>
        </Pressable>
      ) : null}

      {phoneLayout && layerMenuOpen ? (
        <Pressable
          accessibilityLabel={strings.closeLayerMenu}
          accessibilityRole="button"
          onPress={() => setLayerMenuOpen(false)}
          style={styles.layerSheetBackdrop}
        />
      ) : null}

      {!phoneLayout || layerMenuOpen ? (
        <ScrollView
          accessibilityViewIsModal={phoneLayout}
          contentContainerStyle={styles.layerPanelContent}
          showsVerticalScrollIndicator={false}
          style={[
            styles.layerPanel,
            phoneLayout && styles.layerSheet,
            {
              top: phoneLayout ? undefined : layerPanelTop,
              width: phoneLayout ? undefined : layerPanelWidth,
              maxHeight: phoneLayout
                ? Math.min(screenHeight * 0.72, screenHeight - insets.top - 24)
                : layerPanelMaxHeight,
            },
          ]}
        >
          {phoneLayout ? (
            <View style={styles.layerSheetHeader}>
              <View style={styles.layerSheetHandle} />
              <View style={styles.layerSheetTitleRow}>
                <View>
                  <Text style={styles.layerSheetTitle}>
                    {strings.layerMenu}
                  </Text>
                  <Text style={styles.layerSheetSubtitle}>
                    {activeLayerCount} actief
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={strings.closeLayerMenu}
                  accessibilityRole="button"
                  hitSlop={4}
                  onPress={() => setLayerMenuOpen(false)}
                  style={({ pressed }) => [
                    styles.layerSheetClose,
                    pressed && styles.layerButtonPressed,
                  ]}
                >
                  <Ionicons color="#0c4a6e" name="close" size={24} />
                </Pressable>
              </View>
            </View>
          ) : null}
          <LayerMenu
            compact={phoneLayout}
            onToggle={(layer) => {
              if (layer === 'depth' && depthVisible) {
                clearDepthInspection();
                if (activeMapSelection?.kind === 'depth') {
                  setActiveMapSelection(null);
                }
              }
              if (layer === 'vessels' && vesselsVisible) {
                setSelectedVesselMmsi(null);
                if (activeMapSelection?.kind === 'vessel') {
                  setActiveMapSelection(null);
                }
              }
              if (layer === 'fairway' && fairwaysVisible) {
                setSelectedFairwayId(null);
                if (activeMapSelection?.kind === 'fairway') {
                  setActiveMapSelection(null);
                }
              }
              if (layer === 'buoys' && markersVisible) {
                setSelectedMarkerId(null);
                if (activeMapSelection?.kind === 'marker') {
                  setActiveMapSelection(null);
                }
              }
              if (layer === 'bridgesLocks' && bridgesVisible) {
                setSelectedBridgeId(null);
                if (activeMapSelection?.kind === 'bridge') {
                  setActiveMapSelection(null);
                }
              }
              toggleLayer(layer);
            }}
            visibility={layerVisibility}
          />

          {vesselsVisible ? (
            <View style={styles.aisPanel}>
              <Text style={styles.aisStatus}>
                {isOffline
                  ? strings.aisOffline
                  : aisStatus === 'connected'
                    ? strings.aisConnected(vessels.length)
                    : aisStatus === 'connecting'
                      ? strings.aisConnecting
                      : (aisError ?? strings.aisUnavailable)}
              </Text>
              {selectedVessel ? (
                <View style={styles.vesselDetails}>
                  <Text style={styles.vesselName}>
                    {selectedVessel.name ?? strings.aisVesselUnknown}
                  </Text>
                  <Text style={styles.vesselMeta}>
                    {strings.aisMmsi(selectedVessel.mmsi)}
                  </Text>
                  <View style={styles.vesselValues}>
                    {selectedVessel.speedKnots !== null ? (
                      <Text style={styles.vesselMeta}>
                        {strings.aisSpeed(
                          selectedVessel.speedKnots
                            .toFixed(1)
                            .replace('.', ','),
                        )}
                      </Text>
                    ) : null}
                    {selectedVessel.courseDegrees !== null ? (
                      <Text style={styles.vesselMeta}>
                        {strings.aisCourse(
                          Math.round(selectedVessel.courseDegrees).toString(),
                        )}
                      </Text>
                    ) : null}
                  </View>
                  {shipTypeLabel(selectedVessel.shipType) ? (
                    <Text style={styles.vesselMeta}>
                      {strings.aisType(shipTypeLabel(selectedVessel.shipType)!)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {fairwaysVisible ? (
            <View style={styles.navigationPanel}>
              <Text style={styles.navigationStatus}>
                {fairwayError ??
                  (fairwaysLoading
                    ? strings.fairwaysLoading
                    : fairways.length > 0
                      ? `${fairways.length} vaarwegsegmenten`
                      : strings.fairwaysNoData)}
              </Text>
              {selectedFairway ? (
                <View style={styles.navigationDetails}>
                  <Text style={styles.navigationName}>
                    {selectedFairway.name ?? strings.fairwayUnknown}
                  </Text>
                  <Text style={styles.navigationMeta}>
                    {selectedFairway.cemtClass === 'unknown'
                      ? strings.fairwayUnknown
                      : strings.fairwayClass(selectedFairway.cemtClass)}
                  </Text>
                  {selectedFairway.description ? (
                    <Text style={styles.navigationMeta}>
                      {selectedFairway.description}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {markersVisible ? (
            <View style={styles.navigationPanel}>
              <Text style={styles.navigationStatus}>
                {!markersAvailableAtZoom
                  ? strings.markersZoomIn
                  : (markersError ??
                    (markersLoading
                      ? strings.markersLoading
                      : markers.length > 0
                        ? `${markers.length} boeien en bakens`
                        : strings.markersNoData))}
              </Text>
              {selectedMarker ? (
                <View style={styles.navigationDetails}>
                  <Text style={styles.navigationName}>
                    {selectedMarker.name ?? strings.markerUnknown}
                  </Text>
                  <Text style={styles.navigationMeta}>
                    {strings.markerType(
                      selectedMarker.type === 'buoy' ? 'boei' : 'baken',
                    )}
                  </Text>
                  {selectedMarker.number ? (
                    <Text style={styles.navigationMeta}>
                      {strings.markerNumber(selectedMarker.number)}
                    </Text>
                  ) : null}
                  {selectedMarker.waterway ? (
                    <Text style={styles.navigationMeta}>
                      {strings.markerWaterway(selectedMarker.waterway)}
                    </Text>
                  ) : null}
                  {selectedMarker.description ? (
                    <Text style={styles.navigationMeta}>
                      {strings.markerDescription(selectedMarker.description)}
                    </Text>
                  ) : null}
                  {selectedMarker.color ? (
                    <Text style={styles.navigationMeta}>
                      {strings.markerColor(selectedMarker.color)}
                    </Text>
                  ) : null}
                  {selectedMarker.colorPattern ? (
                    <Text style={styles.navigationMeta}>
                      {strings.markerColorPattern(selectedMarker.colorPattern)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {bridgesVisible ? (
            <View style={styles.navigationPanel}>
              <Text style={styles.navigationStatus}>
                {bridgeError ?? `${bridges.length} bruggen in dit kaartgebied`}
              </Text>
              {selectedBridge ? (
                <View style={styles.navigationDetails}>
                  <Text style={styles.navigationName}>
                    {selectedBridge.name}
                  </Text>
                  <Text style={styles.navigationMeta}>
                    {selectedBridge.liveStatus === 'open'
                      ? 'Live open'
                      : 'Live status onbekend'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.mapStyleSection}>
            <Text style={styles.mapStyleTitle}>{strings.mapStyle}</Text>
            <View
              style={[
                styles.mapStyleButtons,
                phoneLayout && styles.mapStyleButtonsPhone,
              ]}
            >
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
                      phoneLayout && styles.mapStyleButtonPhone,
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
                    </Text>
                  </Pressable>
                  <Text style={styles.dataTimestamp}>
                    {strings.updatedAt(formatDataTimestamp(weather.fetchedAt))}
                  </Text>
                  {isOffline ? (
                    <Text style={styles.offlineStatus}>
                      {weatherIsStale
                        ? strings.offlineStoredStaleData
                        : strings.offlineStoredData}
                    </Text>
                  ) : weatherIsStale ? (
                    <Text style={styles.staleStatus}>
                      {strings.staleWeatherData}
                    </Text>
                  ) : weather.isCached ? (
                    <Text style={styles.dataTimestamp}>
                      {strings.cachedData}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.weatherError}>
                  {isOffline
                    ? strings.weatherOfflineUnavailable
                    : (weatherError ?? strings.weatherUnavailable)}
                </Text>
              )}
              {!windAnimationAvailable ? (
                <Text style={styles.windAnimationStatus}>
                  {strings.windZoomIn}
                </Text>
              ) : isOffline ? (
                <Text style={styles.offlineStatus}>
                  {windField
                    ? windFieldAvailableOffline
                      ? strings.windFieldOffline
                      : strings.windFieldOutsideOfflineArea
                    : strings.windFieldOfflineUnavailable}
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
              {isOffline ? (
                <Text style={styles.offlineStatus}>{strings.depthOffline}</Text>
              ) : depthMode === 'bathymetry' && isInspecting ? (
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
      ) : null}

      {isMocked ? (
        <View style={[styles.mockBadge, { top: insets.top + 14 }]}>
          <Text style={styles.mockBadgeText}>
            {strings.developmentLocation}
          </Text>
        </View>
      ) : null}

      {statusMessage ? (
        <View style={[styles.statusCard, { bottom: insets.bottom + 90 }]}>
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
          phoneLayout && styles.locationButtonPhone,
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
    pointerEvents: 'none',
    boxShadow: '0 2px 5px rgba(66, 32, 6, 0.2)',
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
    boxShadow: '0 3px 7px rgba(8, 47, 73, 0.2)',
    elevation: 5,
  },
  layerSheet: {
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1200,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
    boxShadow: '0 -4px 12px rgba(8, 47, 73, 0.24)',
  },
  layerSheetBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1100,
    backgroundColor: 'rgba(8, 47, 73, 0.34)',
  },
  layerSheetHeader: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  layerSheetHandle: {
    width: 36,
    height: 4,
    alignSelf: 'center',
    marginBottom: 10,
    marginTop: 7,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
  },
  layerSheetTitleRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  layerSheetTitle: {
    color: '#082f49',
    fontSize: 18,
    fontWeight: '800',
  },
  layerSheetSubtitle: {
    marginTop: 1,
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  layerSheetClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#e0f2fe',
  },
  layerMenuTrigger: {
    position: 'absolute',
    left: 12,
    zIndex: 1000,
    minWidth: 116,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#075985',
    boxShadow: '0 2px 6px rgba(8, 47, 73, 0.24)',
    elevation: 5,
  },
  layerMenuTriggerText: {
    color: '#f0f9ff',
    fontSize: 13,
    fontWeight: '800',
  },
  layerCountBadge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: '#e0f2fe',
  },
  layerCountText: {
    color: '#075985',
    fontSize: 11,
    fontWeight: '800',
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
  aisPanel: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
  },
  aisStatus: {
    color: '#075985',
    fontSize: 10,
    fontWeight: '700',
  },
  vesselDetails: {
    gap: 2,
    marginTop: 7,
    padding: 8,
    borderRadius: 9,
    backgroundColor: '#e0f2fe',
  },
  vesselName: {
    color: '#082f49',
    fontSize: 13,
    fontWeight: '800',
  },
  vesselMeta: {
    color: '#334155',
    fontSize: 10,
    lineHeight: 14,
  },
  navigationPanel: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: '#bae6fd',
  },
  navigationStatus: {
    color: '#075985',
    fontSize: 10,
    fontWeight: '700',
  },
  navigationDetails: {
    gap: 2,
    marginTop: 7,
    padding: 8,
    borderRadius: 9,
    backgroundColor: '#e0f2fe',
  },
  navigationName: {
    color: '#082f49',
    fontSize: 13,
    fontWeight: '800',
  },
  navigationMeta: {
    color: '#334155',
    fontSize: 10,
    lineHeight: 14,
  },
  vesselValues: {
    flexDirection: 'row',
    gap: 10,
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
  mapStyleButtonsPhone: {
    flexWrap: 'wrap',
    gap: 8,
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
  mapStyleButtonPhone: {
    minHeight: 48,
    flexBasis: '47%',
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
  dataTimestamp: {
    marginTop: 3,
    color: '#64748b',
    fontSize: 10,
    lineHeight: 14,
  },
  offlineStatus: {
    marginTop: 4,
    color: '#92400e',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  staleStatus: {
    marginTop: 4,
    color: '#b45309',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
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
    pointerEvents: 'none',
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
    boxShadow: '0 3px 6px rgba(8, 47, 73, 0.3)',
    elevation: 6,
  },
  locationButtonPressed: {
    backgroundColor: '#075985',
    transform: [{ scale: 0.96 }],
  },
  locationButtonDisabled: {
    opacity: 0.7,
  },
  locationButtonPhone: {
    right: 12,
    width: 48,
    height: 48,
    borderRadius: 14,
  },
});
