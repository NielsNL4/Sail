import Mapbox, {
  type LineLayerStyle,
  type MapState,
  type SymbolLayerStyle,
} from '@rnmapbox/maps';
import {
  type ComponentRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useWindField, windFieldContainsRegion } from '@/hooks';
import { strings } from '@/i18n';
import { useLocationStore } from '@/stores';
import type { MapRegion, MapStyleId, WindColorMode, WindField } from '@/types';
import { DEFAULT_MAP_ZOOM } from '@/utils';
import {
  isOwnLocationVisible,
  OWN_VESSEL_SOURCE_ID,
  ownVesselToGeoJson,
} from '../../utils/ownMotion';

import type { BaseMapProps } from './BaseMap.types';
import {
  NAVIGATION_ARRIVAL_LAYER_ID,
  NAVIGATION_GUIDANCE_SOURCE_ID,
  NAVIGATION_PROJECTION_LAYER_ID,
  NAVIGATION_ROUTE_LAYER_ID,
  NAVIGATION_TARGET_LAYER_ID,
  NAVIGATION_TRACK_LAYER_ID,
  navigationOverlayToGeoJson,
} from './navigationGuidanceLayer';
import {
  SAILING_GUIDANCE_SOURCE_ID,
  SAILING_NO_GO_LAYER_ID,
  SAILING_PORT_LAYER_ID,
  SAILING_STARBOARD_LAYER_ID,
  SAILING_TACK_POINT_LAYER_ID,
  sailingOverlayToGeoJson,
} from './sailingGuidanceLayer';
import {
  FAIRWAY_HIT_LAYER_ID,
  FAIRWAY_LAYER_ID,
  FAIRWAY_SOURCE_ID,
  MARKER_HIT_LAYER_ID,
  MARKER_SOURCE_ID,
  MARKER_SYMBOL_LAYER_ID,
  BRIDGE_HIT_LAYER_ID,
  BRIDGE_SOURCE_ID,
  BRIDGE_SYMBOL_LAYER_ID,
  bridgesToGeoJson,
  fairwayColor,
  fairwaysToGeoJson,
  markersToGeoJson,
} from './navigationLayer';
import {
  BATHYMETRY_ATTRIBUTION,
  BATHYMETRY_BOUNDS,
  COASTAL_BATHYMETRY_TILE_URL,
  COASTAL_DEPTH_LAYER_ID,
  COASTAL_DEPTH_SOURCE_ID,
  ENC_LAYER_ID,
  ENC_SOURCE_ID,
  INLAND_BATHYMETRY_TILE_URL,
  INLAND_DEPTH_LAYER_ID,
  INLAND_DEPTH_SOURCE_ID,
  INLAND_ENC_BOUNDS,
  INLAND_ENC_TILE_URL,
  MIN_DEPTH_RASTER_ZOOM,
  MIN_INLAND_DEPTH_RASTER_ZOOM,
  WIND_PARTICLE_LAYER_IDS,
  WIND_SOURCE_ID,
  coordinatesToRegion,
  getMapStyleUrl,
  regionToZoom,
} from './mapboxConfig';
import {
  VESSEL_HIT_LAYER_ID,
  VESSEL_MARKER_LAYER_ID,
  VESSEL_SOURCE_ID,
  vesselsToGeoJson,
} from './vesselLayer';
import {
  advanceWindParticles,
  createWindParticles,
  EMPTY_WIND_PARTICLES,
  MIN_WIND_PARTICLE_ZOOM,
  particleBoundsForRegion,
  particlesToGeoJson,
  shouldRenderWindParticles,
  windBucketColor,
  windParticleCount,
  windTrailGradient,
} from './windParticles';

const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}

interface WindParticleLayerProps {
  field: WindField | null;
  visible: boolean;
  zoom: number;
  region: MapRegion;
  mapStyle: MapStyleId;
  colorMode: WindColorMode;
}

function WindParticleLayer({
  field,
  visible,
  zoom,
  region,
  mapStyle,
  colorMode,
}: WindParticleLayerProps) {
  const [shape, setShape] = useState(EMPTY_WIND_PARTICLES);
  const layerStyles = useMemo(
    () =>
      WIND_PARTICLE_LAYER_IDS.map((_, bucket): LineLayerStyle => ({
        lineBlur: 0.15,
        lineCap: 'round',
        lineGradient: windTrailGradient(
          windBucketColor(bucket as 0 | 1 | 2 | 3, mapStyle, colorMode),
        ) as unknown as LineLayerStyle['lineGradient'],
        lineJoin: 'round',
        lineOpacity: 0.95,
        lineWidth: ['interpolate', ['linear'], ['zoom'], 8, 0.9, 18, 1.8],
        visibility: visible ? 'visible' : 'none',
      })),
    [colorMode, mapStyle, visible],
  );

  useEffect(() => {
    if (!field || !visible) {
      return;
    }

    const spawnBounds = particleBoundsForRegion(field, region);
    let particles = createWindParticles(
      spawnBounds,
      windParticleCount(zoom, 200),
    );
    let lastUpdate = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      particles = advanceWindParticles(
        particles,
        field,
        (now - lastUpdate) / 1_000,
        zoom,
        spawnBounds,
      );
      setShape(particlesToGeoJson(particles, field));
      lastUpdate = now;
    }, 100);

    return () => clearInterval(interval);
  }, [field, region, visible, zoom]);

  return (
    <Mapbox.ShapeSource id={WIND_SOURCE_ID} lineMetrics shape={shape}>
      {WIND_PARTICLE_LAYER_IDS.map((layerId, bucket) => (
        <Mapbox.LineLayer
          filter={['==', ['get', 'bucket'], bucket]}
          id={layerId}
          key={layerId}
          minZoomLevel={MIN_WIND_PARTICLE_ZOOM}
          style={layerStyles[bucket]}
        />
      ))}
    </Mapbox.ShapeSource>
  );
}

const OwnVesselLayer = memo(function OwnVesselLayer({
  location,
}: Pick<BaseMapProps, 'location'>) {
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);
  const shape = useMemo(
    () => ownVesselToGeoJson(location, nowMs),
    [location, nowMs],
  );
  return (
    <Mapbox.ShapeSource id={OWN_VESSEL_SOURCE_ID} shape={shape}>
      <Mapbox.LineLayer
        id="own-vessel-vector"
        filter={['==', ['get', 'kind'], 'vector']}
        style={{
          lineCap: 'round',
          lineColor: ['get', 'color'],
          lineWidth: 2.5,
          lineDasharray: [3, 2],
        }}
      />
      <Mapbox.CircleLayer
        id="own-vessel-halo"
        filter={['==', ['get', 'kind'], 'position']}
        style={{
          circleColor: ['get', 'color'],
          circleRadius: 16,
          circleOpacity: 0.2,
        }}
      />
      <Mapbox.CircleLayer
        id="own-vessel-neutral"
        filter={[
          'all',
          ['==', ['get', 'kind'], 'position'],
          ['==', ['get', 'directional'], false],
        ]}
        style={{
          circleColor: ['get', 'color'],
          circleRadius: 7,
          circleStrokeColor: '#ffffff',
          circleStrokeWidth: 3,
        }}
      />
      <Mapbox.SymbolLayer
        id="own-vessel-direction"
        filter={[
          'all',
          ['==', ['get', 'kind'], 'position'],
          ['==', ['get', 'directional'], true],
        ]}
        style={{
          textField: '▲',
          textSize: 26,
          textAllowOverlap: true,
          textIgnorePlacement: true,
          textRotationAlignment: 'map',
          textPitchAlignment: 'map',
          textRotate: ['get', 'rotation'],
          textColor: ['get', 'color'],
          textHaloColor: '#ffffff',
          textHaloWidth: 2,
        }}
      />
    </Mapbox.ShapeSource>
  );
});

export default function BaseMap({
  initialRegion,
  location,
  focusRequestId,
  depthMode,
  depthVisible,
  windVisible,
  mapStyle,
  windColorMode,
  networkAvailable,
  navigationOverlay,
  sailingOverlay,
  destinationSelectionActive,
  calloutAnchor,
  onCalloutPointChange,
  onDepthPress,
  vessels,
  vesselsVisible,
  onVesselPress,
  fairways,
  fairwaysVisible,
  markers,
  markersVisible,
  onFairwayPress,
  onMarkerPress,
  onMapPress,
  vesselProfile,
  bridges,
  bridgesVisible,
  onBridgePress,
}: BaseMapProps) {
  const cameraRef = useRef<ComponentRef<typeof Mapbox.Camera>>(null);
  const consumedFocusRequestRef = useRef(0);
  const [mapReady, setMapReady] = useState(false);
  const mapViewRef = useRef<ComponentRef<typeof Mapbox.MapView>>(null);
  const calloutAnchorRef = useRef(calloutAnchor);
  const onCalloutPointChangeRef = useRef(onCalloutPointChange);
  const calloutProjectionFrameRef = useRef<number | null>(null);
  const [initialViewport] = useState(
    () => useLocationStore.getState().mapRegion ?? initialRegion,
  );
  const [initialZoom] = useState(
    () => useLocationStore.getState().mapZoom ?? regionToZoom(initialViewport),
  );
  const [zoom, setZoom] = useState(initialZoom);
  const restoredRegion = useRef(false);
  const mapRegion = useLocationStore((state) => state.mapRegion);
  const setMapViewport = useLocationStore((state) => state.setMapViewport);
  const windRegion = mapRegion ?? initialRegion;
  const windAnimationEnabled = windVisible && shouldRenderWindParticles(zoom);
  const { field: windField } = useWindField(
    windRegion,
    windAnimationEnabled && networkAvailable,
    zoom,
  );
  const windRenderingEnabled =
    windAnimationEnabled &&
    (networkAvailable ||
      Boolean(windField && windFieldContainsRegion(windField, windRegion)));
  const fairwayShape = useMemo(
    () => fairwaysToGeoJson(fairways, vesselProfile),
    [fairways, vesselProfile],
  );
  const markerShape = useMemo(() => markersToGeoJson(markers), [markers]);
  const bridgeShape = useMemo(() => bridgesToGeoJson(bridges), [bridges]);
  const vesselShape = useMemo(() => vesselsToGeoJson(vessels), [vessels]);
  const navigationShape = useMemo(
    () => navigationOverlayToGeoJson(navigationOverlay),
    [navigationOverlay],
  );
  const sailingShape = useMemo(
    () => sailingOverlayToGeoJson(sailingOverlay),
    [sailingOverlay],
  );

  const scheduleCalloutProjection = useCallback(() => {
    if (calloutProjectionFrameRef.current !== null) return;

    calloutProjectionFrameRef.current = requestAnimationFrame(() => {
      calloutProjectionFrameRef.current = null;
      const anchor = calloutAnchorRef.current;

      if (!anchor) {
        onCalloutPointChangeRef.current(null);
        return;
      }

      void mapViewRef.current
        ?.getPointInView([anchor.longitude, anchor.latitude])
        .then((point) => {
          if (anchor !== calloutAnchorRef.current) return;
          onCalloutPointChangeRef.current({ x: point[0], y: point[1] });
        });
    });
  }, []);

  useEffect(() => {
    onCalloutPointChangeRef.current = onCalloutPointChange;
  }, [onCalloutPointChange]);

  useEffect(() => {
    calloutAnchorRef.current = calloutAnchor;
    scheduleCalloutProjection();
  }, [calloutAnchor, scheduleCalloutProjection]);

  useEffect(
    () => () => {
      if (calloutProjectionFrameRef.current !== null) {
        cancelAnimationFrame(calloutProjectionFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!mapRegion || restoredRegion.current) {
      return;
    }

    cameraRef.current?.setCamera({
      centerCoordinate: [mapRegion.longitude, mapRegion.latitude],
      zoomLevel: useLocationStore.getState().mapZoom ?? regionToZoom(mapRegion),
      pitch: 0,
      animationDuration: 0,
    });
    restoredRegion.current = true;
  }, [mapRegion]);

  useEffect(() => {
    const camera = cameraRef.current;

    if (
      !isOwnLocationVisible(location) ||
      focusRequestId === 0 ||
      consumedFocusRequestRef.current === focusRequestId ||
      !camera ||
      !mapReady
    ) {
      return;
    }

    camera.setCamera({
      centerCoordinate: [
        location.coordinates.longitude,
        location.coordinates.latitude,
      ],
      zoomLevel: DEFAULT_MAP_ZOOM,
      pitch: 0,
      animationDuration: 600,
    });
    consumedFocusRequestRef.current = focusRequestId;
  }, [focusRequestId, location, mapReady]);

  const handleMapIdle = (state: MapState) => {
    const { center, bounds } = state.properties;
    setZoom(state.properties.zoom);
    setMapViewport(
      coordinatesToRegion(center, bounds.ne, bounds.sw),
      state.properties.zoom,
    );
  };

  if (!accessToken) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{strings.mapTokenMissing}</Text>
      </View>
    );
  }

  return (
    <Mapbox.MapView
      attributionEnabled
      compassEnabled
      logoEnabled
      onCameraChanged={scheduleCalloutProjection}
      onDidFinishLoadingMap={() => setMapReady(true)}
      onMapIdle={handleMapIdle}
      onPress={async (feature) => {
        const pressPoint = {
          x: feature.properties.screenPointX,
          y: feature.properties.screenPointY,
        };
        const pressCoordinates = {
          latitude: feature.geometry.coordinates[1],
          longitude: feature.geometry.coordinates[0],
        };
        if (destinationSelectionActive) {
          onMapPress(pressCoordinates, pressPoint);
          return;
        }
        const vesselFeatures =
          await mapViewRef.current?.queryRenderedFeaturesAtPoint(
            [pressPoint.x, pressPoint.y],
            [],
            [
              VESSEL_HIT_LAYER_ID,
              VESSEL_MARKER_LAYER_ID,
              MARKER_HIT_LAYER_ID,
              MARKER_SYMBOL_LAYER_ID,
              FAIRWAY_HIT_LAYER_ID,
              FAIRWAY_LAYER_ID,
              BRIDGE_HIT_LAYER_ID,
              BRIDGE_SYMBOL_LAYER_ID,
            ],
          );
        const mmsi = vesselFeatures?.features[0]?.properties?.mmsi;
        if (typeof mmsi === 'string') {
          onVesselPress(mmsi, pressPoint, pressCoordinates);
          return;
        }
        const featureProperties = vesselFeatures?.features[0]?.properties;
        const markerId = featureProperties?.id;
        if (
          typeof markerId === 'string' &&
          typeof featureProperties?.type === 'string'
        ) {
          onMarkerPress(markerId, pressPoint, pressCoordinates);
          return;
        }
        const fairwayId = featureProperties?.id;
        if (
          typeof fairwayId === 'string' &&
          featureProperties?.kind === 'bridge'
        ) {
          onBridgePress(fairwayId, pressPoint, pressCoordinates);
          return;
        }
        if (typeof fairwayId === 'string') {
          onFairwayPress(fairwayId, pressPoint, pressCoordinates);
          return;
        }

        onMapPress(pressCoordinates, pressPoint);
        const pressZoom = (await mapViewRef.current?.getZoom()) ?? zoom;

        if (
          depthVisible &&
          depthMode === 'bathymetry' &&
          networkAvailable &&
          pressZoom >= MIN_DEPTH_RASTER_ZOOM
        ) {
          onDepthPress(pressCoordinates, pressZoom, pressPoint);
        }
      }}
      pitchEnabled={false}
      projection="mercator"
      rotateEnabled
      scaleBarEnabled
      scaleBarUnits="nautical"
      scrollEnabled
      style={StyleSheet.absoluteFill}
      styleURL={getMapStyleUrl(mapStyle)}
      ref={mapViewRef}
      zoomEnabled
    >
      <Mapbox.Camera
        ref={cameraRef}
        defaultSettings={{
          centerCoordinate: [
            initialViewport.longitude,
            initialViewport.latitude,
          ],
          zoomLevel: initialZoom,
          pitch: 0,
        }}
        maxZoomLevel={18}
        minZoomLevel={5}
      />

      <Mapbox.RasterSource
        attribution={BATHYMETRY_ATTRIBUTION}
        id={COASTAL_DEPTH_SOURCE_ID}
        maxZoomLevel={18}
        minZoomLevel={5}
        sourceBounds={BATHYMETRY_BOUNDS}
        tileSize={512}
        tileUrlTemplates={[COASTAL_BATHYMETRY_TILE_URL]}
      >
        <Mapbox.RasterLayer
          id={COASTAL_DEPTH_LAYER_ID}
          maxZoomLevel={MIN_INLAND_DEPTH_RASTER_ZOOM}
          minZoomLevel={MIN_DEPTH_RASTER_ZOOM}
          style={{
            rasterFadeDuration: 0,
            rasterOpacity: 0.62,
            visibility:
              depthVisible && depthMode === 'bathymetry' ? 'visible' : 'none',
          }}
        />
      </Mapbox.RasterSource>
      <Mapbox.RasterSource
        attribution={BATHYMETRY_ATTRIBUTION}
        id={INLAND_DEPTH_SOURCE_ID}
        maxZoomLevel={18}
        minZoomLevel={5}
        sourceBounds={BATHYMETRY_BOUNDS}
        tileSize={512}
        tileUrlTemplates={[INLAND_BATHYMETRY_TILE_URL]}
      >
        <Mapbox.RasterLayer
          id={INLAND_DEPTH_LAYER_ID}
          minZoomLevel={MIN_INLAND_DEPTH_RASTER_ZOOM}
          style={{
            rasterFadeDuration: 0,
            rasterOpacity: 0.72,
            visibility:
              depthVisible && depthMode === 'bathymetry' ? 'visible' : 'none',
          }}
        />
      </Mapbox.RasterSource>
      <Mapbox.RasterSource
        attribution={BATHYMETRY_ATTRIBUTION}
        id={ENC_SOURCE_ID}
        maxZoomLevel={18}
        minZoomLevel={5}
        sourceBounds={INLAND_ENC_BOUNDS}
        tileSize={512}
        tileUrlTemplates={[INLAND_ENC_TILE_URL]}
      >
        <Mapbox.RasterLayer
          id={ENC_LAYER_ID}
          minZoomLevel={MIN_DEPTH_RASTER_ZOOM}
          style={{
            rasterFadeDuration: 0,
            rasterOpacity: 0.92,
            visibility:
              depthVisible && depthMode === 'enc' ? 'visible' : 'none',
          }}
        />
      </Mapbox.RasterSource>
      <WindParticleLayer
        colorMode={windColorMode}
        field={windField}
        mapStyle={mapStyle}
        region={windRegion}
        visible={windRenderingEnabled}
        zoom={zoom}
      />
      <Mapbox.ShapeSource id={FAIRWAY_SOURCE_ID} shape={fairwayShape}>
        <Mapbox.LineLayer
          id={FAIRWAY_HIT_LAYER_ID}
          style={{
            lineColor: '#075985',
            lineOpacity: 0,
            lineWidth: 14,
            visibility: fairwaysVisible ? 'visible' : 'none',
          }}
        />
        <Mapbox.LineLayer
          id={FAIRWAY_LAYER_ID}
          style={{
            lineColor: [
              'case',
              ['get', 'unsuitable'],
              '#dc2626',
              fairwayColor('IV'),
            ],
            lineOpacity: 0.86,
            lineWidth: ['interpolate', ['linear'], ['zoom'], 5, 1.2, 14, 4],
            visibility: fairwaysVisible ? 'visible' : 'none',
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id={SAILING_GUIDANCE_SOURCE_ID} shape={sailingShape}>
        <Mapbox.FillLayer
          filter={['==', ['get', 'kind'], 'no-go']}
          id={SAILING_NO_GO_LAYER_ID}
          style={{
            fillColor: '#dc2626',
            fillOpacity: 0.12,
            fillOutlineColor: '#ef4444',
          }}
        />
        <Mapbox.LineLayer
          filter={['==', ['get', 'kind'], 'port']}
          id={SAILING_PORT_LAYER_ID}
          style={{
            lineCap: 'round',
            lineColor: '#dc2626',
            lineDasharray: [3, 2],
            lineOpacity: 0.9,
            lineWidth: ['interpolate', ['linear'], ['zoom'], 7, 1.5, 15, 3],
          }}
        />
        <Mapbox.LineLayer
          filter={['==', ['get', 'kind'], 'starboard']}
          id={SAILING_STARBOARD_LAYER_ID}
          style={{
            lineCap: 'round',
            lineColor: '#16a34a',
            lineDasharray: [1, 1.5],
            lineOpacity: 0.9,
            lineWidth: ['interpolate', ['linear'], ['zoom'], 7, 1.5, 15, 3],
          }}
        />
        <Mapbox.CircleLayer
          filter={['==', ['get', 'kind'], 'tack-point']}
          id={SAILING_TACK_POINT_LAYER_ID}
          style={{
            circleColor: '#fbbf24',
            circleRadius: 6,
            circleStrokeColor: '#78350f',
            circleStrokeWidth: 2,
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource
        id={NAVIGATION_GUIDANCE_SOURCE_ID}
        shape={navigationShape}
      >
        <Mapbox.FillLayer
          filter={['==', ['get', 'kind'], 'arrival']}
          id={NAVIGATION_ARRIVAL_LAYER_ID}
          style={{
            fillColor: '#f97316',
            fillOpacity: 0.14,
            fillOutlineColor: '#ea580c',
          }}
        />
        <Mapbox.LineLayer
          filter={['==', ['get', 'kind'], 'route']}
          id={NAVIGATION_ROUTE_LAYER_ID}
          style={{
            lineCap: 'round',
            lineColor: '#0284c7',
            lineDasharray: [2, 2],
            lineJoin: 'round',
            lineOpacity: 0.82,
            lineWidth: ['interpolate', ['linear'], ['zoom'], 7, 2, 15, 4],
          }}
        />
        <Mapbox.LineLayer
          filter={['==', ['get', 'kind'], 'track']}
          id={NAVIGATION_TRACK_LAYER_ID}
          style={{
            lineCap: 'round',
            lineColor: '#f8fafc',
            lineJoin: 'round',
            lineOpacity: 0.9,
            lineWidth: ['interpolate', ['linear'], ['zoom'], 7, 1.5, 15, 3],
          }}
        />
        <Mapbox.LineLayer
          filter={['==', ['get', 'kind'], 'projection']}
          id={NAVIGATION_PROJECTION_LAYER_ID}
          style={{
            lineCap: 'round',
            lineColor: '#f97316',
            lineDasharray: [1, 1.5],
            lineWidth: ['interpolate', ['linear'], ['zoom'], 7, 2, 15, 4],
          }}
        />
        <Mapbox.CircleLayer
          filter={['==', ['get', 'kind'], 'target']}
          id={NAVIGATION_TARGET_LAYER_ID}
          style={{
            circleColor: '#f97316',
            circleRadius: 8,
            circleStrokeColor: '#fff7ed',
            circleStrokeWidth: 3,
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id={MARKER_SOURCE_ID} shape={markerShape}>
        <Mapbox.CircleLayer
          id={MARKER_HIT_LAYER_ID}
          style={{
            circleColor: [
              'match',
              ['get', 'color'],
              'red',
              '#dc2626',
              'green',
              '#16a34a',
              'yellow',
              '#facc15',
              'black',
              '#111827',
              'white',
              '#f8fafc',
              'orange',
              '#f97316',
              '#94a3b8',
            ],
            circleOpacity: 0.25,
            circleRadius: 13,
            visibility: markersVisible ? 'visible' : 'none',
          }}
        />
        <Mapbox.SymbolLayer
          id={MARKER_SYMBOL_LAYER_ID}
          style={{
            textAllowOverlap: true,
            textColor: [
              'match',
              ['get', 'color'],
              'red',
              '#dc2626',
              'green',
              '#16a34a',
              'yellow',
              '#ca8a04',
              'black',
              '#111827',
              'white',
              '#f8fafc',
              'orange',
              '#f97316',
              '#64748b',
            ],
            textField: ['case', ['==', ['get', 'type'], 'buoy'], '●', '◆'],
            textHaloColor: '#fff7ed',
            textHaloWidth: 1.5,
            textSize: 16,
            visibility: markersVisible ? 'visible' : 'none',
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id={BRIDGE_SOURCE_ID} shape={bridgeShape}>
        <Mapbox.CircleLayer
          id={BRIDGE_HIT_LAYER_ID}
          style={{
            circleOpacity: 0,
            circleRadius: 14,
            visibility: bridgesVisible ? 'visible' : 'none',
          }}
        />
        <Mapbox.SymbolLayer
          id={BRIDGE_SYMBOL_LAYER_ID}
          style={{
            textAllowOverlap: true,
            textField: [
              'case',
              ['==', ['get', 'liveStatus'], 'open'],
              '↕',
              '?',
            ],
            textSize: 18,
            textColor: [
              'case',
              ['==', ['get', 'liveStatus'], 'open'],
              '#dc2626',
              '#475569',
            ],
            visibility: bridgesVisible ? 'visible' : 'none',
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id={VESSEL_SOURCE_ID} shape={vesselShape}>
        <Mapbox.CircleLayer
          id={VESSEL_HIT_LAYER_ID}
          style={{
            circleColor: '#38bdf8',
            circleOpacity: 0.24,
            circleRadius: 12,
            circleStrokeColor: '#082f49',
            circleStrokeWidth: 1,
            visibility: vesselsVisible ? 'visible' : 'none',
          }}
        />
        <Mapbox.SymbolLayer
          id={VESSEL_MARKER_LAYER_ID}
          style={
            {
              textAllowOverlap: true,
              textColor: '#075985',
              textField: '▲',
              textHaloColor: '#f0f9ff',
              textHaloWidth: 1.5,
              textRotate: ['get', 'rotation'],
              textRotationAlignment: 'map',
              textSize: 17,
              visibility: vesselsVisible ? 'visible' : 'none',
            } as SymbolLayerStyle
          }
        />
      </Mapbox.ShapeSource>
      <OwnVesselLayer location={location} />
    </Mapbox.MapView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#082f49',
  },
  errorText: {
    color: '#f0f9ff',
    fontSize: 16,
    textAlign: 'center',
  },
});
