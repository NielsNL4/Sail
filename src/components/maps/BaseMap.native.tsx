import Mapbox, { type LineLayerStyle, type MapState } from '@rnmapbox/maps';
import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useWindField } from '@/hooks';
import { strings } from '@/i18n';
import { useLayersStore, useLocationStore, useSettingsStore } from '@/stores';
import type { MapRegion, MapStyleId, WindColorMode, WindField } from '@/types';
import { DEFAULT_MAP_ZOOM } from '@/utils';

import type { BaseMapProps } from './BaseMap.types';
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
          style={{
            lineBlur: 0.15,
            lineCap: 'round',
            lineGradient: windTrailGradient(
              windBucketColor(bucket as 0 | 1 | 2 | 3, mapStyle, colorMode),
            ) as unknown as LineLayerStyle['lineGradient'],
            lineJoin: 'round',
            lineOpacity: 0.95,
            lineWidth: ['interpolate', ['linear'], ['zoom'], 8, 0.9, 18, 1.8],
            visibility: visible ? 'visible' : 'none',
          }}
        />
      ))}
    </Mapbox.ShapeSource>
  );
}

export default function BaseMap({
  initialRegion,
  location,
  focusRequestId,
  locationTitle,
  depthMode,
  onDepthPress,
}: BaseMapProps) {
  const cameraRef = useRef<ComponentRef<typeof Mapbox.Camera>>(null);
  const mapViewRef = useRef<ComponentRef<typeof Mapbox.MapView>>(null);
  const [initialViewport] = useState(
    () => useLocationStore.getState().mapRegion ?? initialRegion,
  );
  const [initialZoom] = useState(
    () => useLocationStore.getState().mapZoom ?? regionToZoom(initialViewport),
  );
  const [zoom, setZoom] = useState(initialZoom);
  const restoredRegion = useRef(false);
  const mapRegion = useLocationStore((state) => state.mapRegion);
  const setMapRegion = useLocationStore((state) => state.setMapRegion);
  const setMapZoom = useLocationStore((state) => state.setMapZoom);
  const depthVisible = useLayersStore((state) => state.visibility.depth);
  const windVisible = useLayersStore((state) => state.visibility.wind);
  const mapStyle = useSettingsStore((state) => state.mapStyle);
  const windColorMode = useSettingsStore((state) => state.windColorMode);
  const windRegion = mapRegion ?? initialRegion;
  const windAnimationEnabled = windVisible && shouldRenderWindParticles(zoom);
  const { field: windField } = useWindField(
    windRegion,
    windAnimationEnabled,
    zoom,
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
    if (!location || focusRequestId === 0) {
      return;
    }

    cameraRef.current?.setCamera({
      centerCoordinate: [
        location.coordinates.longitude,
        location.coordinates.latitude,
      ],
      zoomLevel: DEFAULT_MAP_ZOOM,
      pitch: 0,
      animationDuration: 600,
    });
  }, [focusRequestId, location]);

  const handleMapIdle = (state: MapState) => {
    const { center, bounds } = state.properties;
    setZoom(state.properties.zoom);
    setMapZoom(state.properties.zoom);
    setMapRegion(coordinatesToRegion(center, bounds.ne, bounds.sw));
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
      onMapIdle={handleMapIdle}
      onPress={async (feature) => {
        const pressZoom = (await mapViewRef.current?.getZoom()) ?? zoom;

        if (
          depthVisible &&
          depthMode === 'bathymetry' &&
          pressZoom >= MIN_DEPTH_RASTER_ZOOM
        ) {
          onDepthPress(
            {
              latitude: feature.geometry.coordinates[1],
              longitude: feature.geometry.coordinates[0],
            },
            pressZoom,
          );
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

      {location?.isMocked ? (
        <Mapbox.PointAnnotation
          coordinate={[
            location.coordinates.longitude,
            location.coordinates.latitude,
          ]}
          id="development-location"
        >
          <View accessibilityLabel={locationTitle} style={styles.mockMarker} />
          <Mapbox.Callout title={locationTitle} />
        </Mapbox.PointAnnotation>
      ) : (
        <Mapbox.UserLocation
          animated
          showsUserHeadingIndicator
          visible={Boolean(location)}
        />
      )}

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
        visible={windAnimationEnabled}
        zoom={zoom}
      />
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
  mockMarker: {
    width: 18,
    height: 18,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 9,
    backgroundColor: '#f59e0b',
  },
});
