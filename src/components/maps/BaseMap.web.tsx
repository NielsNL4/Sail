import mapboxgl, {
  type GeoJSONSource,
  type Map as MapboxMap,
} from 'mapbox-gl-web';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import 'mapbox-gl-web/dist/mapbox-gl.css';

import { useWindField, windFieldContainsRegion } from '@/hooks';
import { strings } from '@/i18n';
import { useLocationStore } from '@/stores';
import type { DepthMode, MapStyleId, WindColorMode } from '@/types';
import { DEFAULT_MAP_ZOOM, isPhoneLayout } from '@/utils';
import {
  isOwnLocationVisible,
  OWN_VESSEL_SOURCE_ID,
  ownVesselToGeoJson,
} from '../../utils/ownMotion';

import type { BaseMapProps } from './BaseMap.types';
import { getOverlayLayerVisibility } from './mapLayerVisibility';
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
  fairwayColor,
  fairwaysToGeoJson,
  bridgesToGeoJson,
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

function hideBuildingAndTrafficLayers(map: MapboxMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (/building|traffic/i.test(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

function registerOverlaySlots(
  map: MapboxMap,
  depthVisible: boolean,
  windVisible: boolean,
  depthMode: DepthMode,
  mapStyle: MapStyleId,
  colorMode: WindColorMode,
  vesselsVisible: boolean,
  fairwaysVisible: boolean,
  markersVisible: boolean,
  bridgesVisible: boolean,
) {
  if (depthVisible && !map.getSource(COASTAL_DEPTH_SOURCE_ID)) {
    map.addSource(COASTAL_DEPTH_SOURCE_ID, {
      type: 'raster',
      tiles: [COASTAL_BATHYMETRY_TILE_URL],
      tileSize: 512,
      bounds: BATHYMETRY_BOUNDS,
      attribution: BATHYMETRY_ATTRIBUTION,
    });
  }

  if (depthVisible && !map.getLayer(COASTAL_DEPTH_LAYER_ID)) {
    map.addLayer({
      id: COASTAL_DEPTH_LAYER_ID,
      type: 'raster',
      source: COASTAL_DEPTH_SOURCE_ID,
      minzoom: MIN_DEPTH_RASTER_ZOOM,
      maxzoom: MIN_INLAND_DEPTH_RASTER_ZOOM,
      layout: {
        visibility:
          depthVisible && depthMode === 'bathymetry' ? 'visible' : 'none',
      },
      paint: {
        'raster-fade-duration': 0,
        'raster-opacity': 0.62,
      },
    });
  }

  if (depthVisible && !map.getSource(INLAND_DEPTH_SOURCE_ID)) {
    map.addSource(INLAND_DEPTH_SOURCE_ID, {
      type: 'raster',
      tiles: [INLAND_BATHYMETRY_TILE_URL],
      tileSize: 512,
      bounds: BATHYMETRY_BOUNDS,
      attribution: BATHYMETRY_ATTRIBUTION,
    });
  }

  if (depthVisible && !map.getLayer(INLAND_DEPTH_LAYER_ID)) {
    map.addLayer({
      id: INLAND_DEPTH_LAYER_ID,
      type: 'raster',
      source: INLAND_DEPTH_SOURCE_ID,
      minzoom: MIN_INLAND_DEPTH_RASTER_ZOOM,
      layout: {
        visibility:
          depthVisible && depthMode === 'bathymetry' ? 'visible' : 'none',
      },
      paint: {
        'raster-fade-duration': 0,
        'raster-opacity': 0.72,
      },
    });
  }

  if (depthVisible && !map.getSource(ENC_SOURCE_ID)) {
    map.addSource(ENC_SOURCE_ID, {
      type: 'raster',
      tiles: [INLAND_ENC_TILE_URL],
      tileSize: 512,
      bounds: INLAND_ENC_BOUNDS,
      attribution: BATHYMETRY_ATTRIBUTION,
    });
  }

  if (depthVisible && !map.getLayer(ENC_LAYER_ID)) {
    map.addLayer({
      id: ENC_LAYER_ID,
      type: 'raster',
      source: ENC_SOURCE_ID,
      minzoom: MIN_DEPTH_RASTER_ZOOM,
      layout: {
        visibility: depthVisible && depthMode === 'enc' ? 'visible' : 'none',
      },
      paint: {
        'raster-fade-duration': 0,
        'raster-opacity': 0.92,
      },
    });
  }

  if (!map.getSource(WIND_SOURCE_ID)) {
    map.addSource(WIND_SOURCE_ID, {
      type: 'geojson',
      data: EMPTY_WIND_PARTICLES,
      lineMetrics: true,
    });
  }

  for (let bucket = 0; bucket < WIND_PARTICLE_LAYER_IDS.length; bucket += 1) {
    const layerId = WIND_PARTICLE_LAYER_IDS[bucket];

    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: WIND_SOURCE_ID,
        minzoom: MIN_WIND_PARTICLE_ZOOM,
        filter: ['==', ['get', 'bucket'], bucket],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
          visibility: windVisible ? 'visible' : 'none',
        },
        paint: {
          'line-blur': 0.15,
          'line-gradient': windTrailGradient(
            windBucketColor(bucket as 0 | 1 | 2 | 3, mapStyle, colorMode),
          ) as unknown as mapboxgl.Expression,
          'line-opacity': 0.95,
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.9, 18, 1.8],
        },
      });
    }
  }

  if (!map.getSource(VESSEL_SOURCE_ID)) {
    map.addSource(VESSEL_SOURCE_ID, {
      type: 'geojson',
      data: vesselsToGeoJson([]),
    });
  }
  if (!map.getLayer(VESSEL_HIT_LAYER_ID)) {
    map.addLayer({
      id: VESSEL_HIT_LAYER_ID,
      type: 'circle',
      source: VESSEL_SOURCE_ID,
      layout: { visibility: vesselsVisible ? 'visible' : 'none' },
      paint: {
        'circle-color': '#38bdf8',
        'circle-opacity': 0.24,
        'circle-radius': 12,
        'circle-stroke-color': '#082f49',
        'circle-stroke-width': 1,
      },
    });
  }
  if (!map.getLayer(VESSEL_MARKER_LAYER_ID)) {
    map.addLayer({
      id: VESSEL_MARKER_LAYER_ID,
      type: 'symbol',
      source: VESSEL_SOURCE_ID,
      layout: {
        visibility: vesselsVisible ? 'visible' : 'none',
        'text-allow-overlap': true,
        'text-field': '▲',
        'text-rotation-alignment': 'map',
        'text-rotate': ['get', 'rotation'],
        'text-size': 17,
      },
      paint: {
        'text-color': '#075985',
        'text-halo-color': '#f0f9ff',
        'text-halo-width': 1.5,
      },
    });
  }

  if (!map.getSource(FAIRWAY_SOURCE_ID)) {
    map.addSource(FAIRWAY_SOURCE_ID, {
      type: 'geojson',
      data: fairwaysToGeoJson([]),
    });
  }
  if (!map.getLayer(FAIRWAY_HIT_LAYER_ID)) {
    map.addLayer({
      id: FAIRWAY_HIT_LAYER_ID,
      type: 'line',
      source: FAIRWAY_SOURCE_ID,
      layout: { visibility: fairwaysVisible ? 'visible' : 'none' },
      paint: { 'line-color': '#075985', 'line-opacity': 0, 'line-width': 12 },
    });
  }
  if (!map.getLayer(FAIRWAY_LAYER_ID)) {
    map.addLayer({
      id: FAIRWAY_LAYER_ID,
      type: 'line',
      source: FAIRWAY_SOURCE_ID,
      layout: { visibility: fairwaysVisible ? 'visible' : 'none' },
      paint: {
        'line-color': [
          'case',
          ['get', 'unsuitable'],
          '#dc2626',
          [
            'match',
            ['get', 'cemtClass'],
            '0',
            fairwayColor('0'),
            'I',
            fairwayColor('I'),
            'II',
            fairwayColor('II'),
            'III',
            fairwayColor('III'),
            'IV',
            fairwayColor('IV'),
            'V',
            fairwayColor('V'),
            'VI',
            fairwayColor('VI'),
            'VIc',
            fairwayColor('VIc'),
            fairwayColor('unknown'),
          ],
        ],
        'line-opacity': 0.86,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.2, 14, 4],
      },
    });
  }
  if (!map.getSource(NAVIGATION_GUIDANCE_SOURCE_ID)) {
    map.addSource(NAVIGATION_GUIDANCE_SOURCE_ID, {
      type: 'geojson',
      data: navigationOverlayToGeoJson(null),
    });
  }
  if (!map.getLayer(NAVIGATION_ARRIVAL_LAYER_ID)) {
    map.addLayer({
      id: NAVIGATION_ARRIVAL_LAYER_ID,
      type: 'fill',
      source: NAVIGATION_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'arrival'],
      paint: {
        'fill-color': '#f97316',
        'fill-opacity': 0.14,
        'fill-outline-color': '#ea580c',
      },
    });
  }
  if (!map.getLayer(NAVIGATION_ROUTE_LAYER_ID)) {
    map.addLayer({
      id: NAVIGATION_ROUTE_LAYER_ID,
      type: 'line',
      source: NAVIGATION_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'route'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#0284c7',
        'line-dasharray': [2, 2],
        'line-opacity': 0.82,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 15, 4],
      },
    });
  }
  if (!map.getLayer(NAVIGATION_TRACK_LAYER_ID)) {
    map.addLayer({
      id: NAVIGATION_TRACK_LAYER_ID,
      type: 'line',
      source: NAVIGATION_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'track'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f8fafc',
        'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 15, 3],
      },
    });
  }
  if (!map.getLayer(NAVIGATION_PROJECTION_LAYER_ID)) {
    map.addLayer({
      id: NAVIGATION_PROJECTION_LAYER_ID,
      type: 'line',
      source: NAVIGATION_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'projection'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': '#f97316',
        'line-dasharray': [1, 1.5],
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 2, 15, 4],
      },
    });
  }
  if (!map.getLayer(NAVIGATION_TARGET_LAYER_ID)) {
    map.addLayer({
      id: NAVIGATION_TARGET_LAYER_ID,
      type: 'circle',
      source: NAVIGATION_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'target'],
      paint: {
        'circle-color': '#f97316',
        'circle-radius': 8,
        'circle-stroke-color': '#fff7ed',
        'circle-stroke-width': 3,
      },
    });
  }
  if (!map.getSource(SAILING_GUIDANCE_SOURCE_ID)) {
    map.addSource(SAILING_GUIDANCE_SOURCE_ID, {
      type: 'geojson',
      data: sailingOverlayToGeoJson(null),
    });
  }
  if (!map.getLayer(SAILING_NO_GO_LAYER_ID)) {
    map.addLayer({
      id: SAILING_NO_GO_LAYER_ID,
      type: 'fill',
      source: SAILING_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'no-go'],
      paint: {
        'fill-color': '#dc2626',
        'fill-opacity': 0.12,
        'fill-outline-color': '#ef4444',
      },
    });
  }
  if (!map.getLayer(SAILING_PORT_LAYER_ID)) {
    map.addLayer({
      id: SAILING_PORT_LAYER_ID,
      type: 'line',
      source: SAILING_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'port'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': '#dc2626',
        'line-dasharray': [3, 2],
        'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 15, 3],
      },
    });
  }
  if (!map.getLayer(SAILING_STARBOARD_LAYER_ID)) {
    map.addLayer({
      id: SAILING_STARBOARD_LAYER_ID,
      type: 'line',
      source: SAILING_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'starboard'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': '#16a34a',
        'line-dasharray': [1, 1.5],
        'line-opacity': 0.9,
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 1.5, 15, 3],
      },
    });
  }
  if (!map.getLayer(SAILING_TACK_POINT_LAYER_ID)) {
    map.addLayer({
      id: SAILING_TACK_POINT_LAYER_ID,
      type: 'circle',
      source: SAILING_GUIDANCE_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'tack-point'],
      paint: {
        'circle-color': '#fbbf24',
        'circle-radius': 6,
        'circle-stroke-color': '#78350f',
        'circle-stroke-width': 2,
      },
    });
  }
  for (const layerId of [
    NAVIGATION_ARRIVAL_LAYER_ID,
    NAVIGATION_ROUTE_LAYER_ID,
    NAVIGATION_TRACK_LAYER_ID,
    NAVIGATION_PROJECTION_LAYER_ID,
    NAVIGATION_TARGET_LAYER_ID,
  ]) {
    map.moveLayer(layerId);
  }
  if (!map.getSource(MARKER_SOURCE_ID)) {
    map.addSource(MARKER_SOURCE_ID, {
      type: 'geojson',
      data: markersToGeoJson([]),
    });
  }
  if (!map.getLayer(MARKER_HIT_LAYER_ID)) {
    map.addLayer({
      id: MARKER_HIT_LAYER_ID,
      type: 'circle',
      source: MARKER_SOURCE_ID,
      layout: { visibility: markersVisible ? 'visible' : 'none' },
      paint: {
        'circle-color': [
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
        'circle-opacity': 0.25,
        'circle-radius': 13,
      },
    });
  }
  if (!map.getLayer(MARKER_SYMBOL_LAYER_ID)) {
    map.addLayer({
      id: MARKER_SYMBOL_LAYER_ID,
      type: 'symbol',
      source: MARKER_SOURCE_ID,
      layout: {
        visibility: markersVisible ? 'visible' : 'none',
        'text-allow-overlap': true,
        'text-field': ['case', ['==', ['get', 'type'], 'buoy'], '●', '◆'],
        'text-size': 16,
      },
      paint: {
        'text-color': [
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
        'text-halo-color': '#fff7ed',
        'text-halo-width': 1.5,
      },
    });
  }
  if (!map.getSource(BRIDGE_SOURCE_ID)) {
    map.addSource(BRIDGE_SOURCE_ID, {
      type: 'geojson',
      data: bridgesToGeoJson([]),
    });
  }
  if (!map.getLayer(BRIDGE_HIT_LAYER_ID)) {
    map.addLayer({
      id: BRIDGE_HIT_LAYER_ID,
      type: 'circle',
      source: BRIDGE_SOURCE_ID,
      layout: { visibility: bridgesVisible ? 'visible' : 'none' },
      paint: {
        'circle-color': '#0f172a',
        'circle-opacity': 0,
        'circle-radius': 14,
      },
    });
  }
  if (!map.getLayer(BRIDGE_SYMBOL_LAYER_ID)) {
    map.addLayer({
      id: BRIDGE_SYMBOL_LAYER_ID,
      type: 'symbol',
      source: BRIDGE_SOURCE_ID,
      layout: {
        visibility: bridgesVisible ? 'visible' : 'none',
        'text-allow-overlap': true,
        'text-field': ['case', ['==', ['get', 'liveStatus'], 'open'], '↕', '?'],
        'text-size': 18,
      },
      paint: {
        'text-color': [
          'case',
          ['==', ['get', 'liveStatus'], 'open'],
          '#dc2626',
          '#475569',
        ],
        'text-halo-color': '#f8fafc',
        'text-halo-width': 1.5,
      },
    });
  }
}

function syncOverlayVisibility(
  map: MapboxMap,
  visibility: Parameters<typeof getOverlayLayerVisibility>[0],
) {
  for (const [layerId, value] of Object.entries(
    getOverlayLayerVisibility(visibility),
  )) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', value);
    }
  }
  // Newly enabled overlays must not cover the own-vessel marker.
  for (const layerId of [
    'own-vessel-vector',
    'own-vessel-halo',
    'own-vessel-neutral',
    'own-vessel-direction',
  ]) {
    if (map.getLayer(layerId)) map.moveLayer(layerId);
  }
}

export default function BaseMap({
  initialRegion,
  location,
  focusRequestId,
  depthMode,
  depthVisible,
  windVisible,
  mapStyle: mapStyleId,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const consumedFocusRequestRef = useRef(0);
  const destinationSelectionActiveRef = useRef(destinationSelectionActive);
  const [initialMapStyle] = useState(mapStyleId);
  const loadedMapStyleRef = useRef(initialMapStyle);
  const [styleReady, setStyleReady] = useState(false);
  const [initialViewport] = useState(
    () => useLocationStore.getState().mapRegion ?? initialRegion,
  );
  const [initialZoom] = useState(
    () => useLocationStore.getState().mapZoom ?? regionToZoom(initialViewport),
  );
  const restoredRegion = useRef(false);
  const mapRegion = useLocationStore((state) => state.mapRegion);
  const setMapViewport = useLocationStore((state) => state.setMapViewport);
  const windRegion = mapRegion ?? initialRegion;
  const [zoom, setZoom] = useState(initialZoom);
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
  const handleDepthPress = useEffectEvent(
    (
      coordinates: { latitude: number; longitude: number },
      pressZoom: number,
      point: { x: number; y: number },
    ) => {
      if (
        depthVisible &&
        depthMode === 'bathymetry' &&
        networkAvailable &&
        pressZoom >= MIN_DEPTH_RASTER_ZOOM
      ) {
        onDepthPress(coordinates, pressZoom, point);
      }
    },
  );
  const handleVesselPress = useEffectEvent(
    (
      mmsi: string,
      point: { x: number; y: number },
      coordinates: { latitude: number; longitude: number },
    ) => {
      onVesselPress(mmsi, point, coordinates);
    },
  );
  const handleFairwayPress = useEffectEvent(
    (
      id: string,
      point: { x: number; y: number },
      coordinates: { latitude: number; longitude: number },
    ) => {
      onFairwayPress(id, point, coordinates);
    },
  );
  const handleMarkerPress = useEffectEvent(
    (
      id: string,
      point: { x: number; y: number },
      coordinates: { latitude: number; longitude: number },
    ) => {
      onMarkerPress(id, point, coordinates);
    },
  );
  const handleBridgePress = useEffectEvent(
    (
      id: string,
      point: { x: number; y: number },
      coordinates: { latitude: number; longitude: number },
    ) => {
      onBridgePress(id, point, coordinates);
    },
  );
  const handleMapPress = useEffectEvent(
    (
      coordinates: { latitude: number; longitude: number },
      point: { x: number; y: number },
    ) => {
      onMapPress(coordinates, point);
    },
  );
  useEffect(() => {
    destinationSelectionActiveRef.current = destinationSelectionActive;
  }, [destinationSelectionActive]);
  const updateCalloutPoint = useEffectEvent((map: MapboxMap) => {
    if (!calloutAnchor) {
      onCalloutPointChange(null);
      return;
    }

    const point = map.project([
      calloutAnchor.longitude,
      calloutAnchor.latitude,
    ]);
    onCalloutPointChange({ x: point.x, y: point.y });
  });
  const handleStyleLoad = useEffectEvent((map: MapboxMap) => {
    map.setFog(null);
    hideBuildingAndTrafficLayers(map);
    registerOverlaySlots(
      map,
      depthVisible,
      windVisible,
      depthMode,
      mapStyleId,
      windColorMode,
      vesselsVisible,
      fairwaysVisible,
      markersVisible,
      bridgesVisible,
    );
    syncOverlayVisibility(map, {
      depthMode,
      depthVisible,
      windVisible,
      vesselsVisible,
      fairwaysVisible,
      markersVisible,
      bridgesVisible,
    });
    (map.getSource(VESSEL_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
      vesselsToGeoJson(vessels),
    );
    (map.getSource(FAIRWAY_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
      fairwaysToGeoJson(fairways, vesselProfile),
    );
    (map.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
      markersToGeoJson(markers),
    );
    (map.getSource(BRIDGE_SOURCE_ID) as GeoJSONSource | undefined)?.setData(
      bridgesToGeoJson(bridges),
    );
    (
      map.getSource(NAVIGATION_GUIDANCE_SOURCE_ID) as GeoJSONSource | undefined
    )?.setData(navigationOverlayToGeoJson(navigationOverlay));
    (
      map.getSource(SAILING_GUIDANCE_SOURCE_ID) as GeoJSONSource | undefined
    )?.setData(sailingOverlayToGeoJson(sailingOverlay));
    map.addSource(OWN_VESSEL_SOURCE_ID, {
      type: 'geojson',
      data: ownVesselToGeoJson(location),
    });
    map.addLayer({
      id: 'own-vessel-vector',
      type: 'line',
      source: OWN_VESSEL_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'vector'],
      layout: { 'line-cap': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2.5,
        'line-dasharray': [3, 2],
      },
    });
    map.addLayer({
      id: 'own-vessel-halo',
      type: 'circle',
      source: OWN_VESSEL_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'position'],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 16,
        'circle-opacity': 0.2,
      },
    });
    map.addLayer({
      id: 'own-vessel-neutral',
      type: 'circle',
      source: OWN_VESSEL_SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'kind'], 'position'],
        ['==', ['get', 'directional'], false],
      ],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': 7,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    });
    map.addLayer({
      id: 'own-vessel-direction',
      type: 'symbol',
      source: OWN_VESSEL_SOURCE_ID,
      filter: [
        'all',
        ['==', ['get', 'kind'], 'position'],
        ['==', ['get', 'directional'], true],
      ],
      layout: {
        'text-field': '▲',
        'text-size': 26,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'text-rotation-alignment': 'map',
        'text-pitch-alignment': 'map',
        'text-rotate': ['get', 'rotation'],
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      },
    });
    setStyleReady(true);
  });

  useEffect(() => {
    if (!containerRef.current || !accessToken) {
      return;
    }

    mapboxgl.accessToken = accessToken;
    const viewport = initialViewport;
    const compactControls = isPhoneLayout(containerRef.current.clientWidth);
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: getMapStyleUrl(initialMapStyle),
      center: [viewport.longitude, viewport.latitude],
      zoom: initialZoom,
      minZoom: 5,
      maxZoom: 18,
      pitch: 0,
      maxPitch: 0,
      dragRotate: true,
      pitchWithRotate: false,
      attributionControl: true,
    });

    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: !compactControls,
        visualizePitch: false,
      }),
      'top-right',
    );
    map.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: compactControls ? 80 : 120,
        unit: 'nautical',
      }),
      'bottom-left',
    );
    map.touchPitch.disable();
    map.on('style.load', () => handleStyleLoad(map));
    map.on('move', () => updateCalloutPoint(map));
    map.on('moveend', () => {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const nextZoom = map.getZoom();

      if (!bounds) return;

      setZoom(nextZoom);
      setMapViewport(
        coordinatesToRegion(
          [center.lng, center.lat],
          [bounds.getEast(), bounds.getNorth()],
          [bounds.getWest(), bounds.getSouth()],
        ),
        nextZoom,
      );
    });
    map.on('click', (event) => {
      const point = { x: event.point.x, y: event.point.y };
      const coordinates = {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      };
      if (destinationSelectionActiveRef.current) {
        handleMapPress(coordinates, point);
        return;
      }
      const vesselFeature = map.queryRenderedFeatures(event.point, {
        layers: [VESSEL_HIT_LAYER_ID, VESSEL_MARKER_LAYER_ID],
      })[0];
      const mmsi = vesselFeature?.properties?.mmsi;
      if (typeof mmsi === 'string') {
        handleVesselPress(mmsi, point, coordinates);
        return;
      }
      const markerFeature = map.queryRenderedFeatures(event.point, {
        layers: [MARKER_HIT_LAYER_ID, MARKER_SYMBOL_LAYER_ID],
      })[0];
      const markerId = markerFeature?.properties?.id;
      if (typeof markerId === 'string') {
        handleMarkerPress(markerId, point, coordinates);
        return;
      }
      const fairwayFeature = map.queryRenderedFeatures(event.point, {
        layers: [FAIRWAY_HIT_LAYER_ID, FAIRWAY_LAYER_ID],
      })[0];
      const fairwayId = fairwayFeature?.properties?.id;
      if (typeof fairwayId === 'string') {
        handleFairwayPress(fairwayId, point, coordinates);
        return;
      }
      const bridgeFeature = map.queryRenderedFeatures(event.point, {
        layers: [BRIDGE_HIT_LAYER_ID, BRIDGE_SYMBOL_LAYER_ID],
      })[0];
      const bridgeId = bridgeFeature?.properties?.id;
      if (typeof bridgeId === 'string') {
        handleBridgePress(bridgeId, point, coordinates);
        return;
      }
      handleMapPress(coordinates, point);
      handleDepthPress(coordinates, map.getZoom(), point);
    });
    mapRef.current = map;

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [
    initialMapStyle,
    initialRegion,
    initialViewport,
    initialZoom,
    setMapViewport,
  ]);

  useEffect(() => {
    if (mapRef.current) updateCalloutPoint(mapRef.current);
  }, [calloutAnchor]);

  useEffect(() => {
    (
      mapRef.current?.getSource(FAIRWAY_SOURCE_ID) as GeoJSONSource | undefined
    )?.setData(fairwaysToGeoJson(fairways, vesselProfile));
  }, [fairways, styleReady, vesselProfile]);

  useEffect(() => {
    (
      mapRef.current?.getSource(MARKER_SOURCE_ID) as GeoJSONSource | undefined
    )?.setData(markersToGeoJson(markers));
  }, [markers, styleReady]);

  useEffect(() => {
    (
      mapRef.current?.getSource(BRIDGE_SOURCE_ID) as GeoJSONSource | undefined
    )?.setData(bridgesToGeoJson(bridges));
  }, [bridges, styleReady]);

  useEffect(() => {
    const source = mapRef.current?.getSource(VESSEL_SOURCE_ID) as
      GeoJSONSource | undefined;
    source?.setData(vesselsToGeoJson(vessels));
  }, [styleReady, vessels]);

  useEffect(() => {
    const source = mapRef.current?.getSource(NAVIGATION_GUIDANCE_SOURCE_ID) as
      GeoJSONSource | undefined;
    source?.setData(navigationOverlayToGeoJson(navigationOverlay));
  }, [navigationOverlay, styleReady]);

  useEffect(() => {
    const source = mapRef.current?.getSource(SAILING_GUIDANCE_SOURCE_ID) as
      GeoJSONSource | undefined;
    source?.setData(sailingOverlayToGeoJson(sailingOverlay));
  }, [sailingOverlay, styleReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || loadedMapStyleRef.current === mapStyleId) {
      return;
    }

    loadedMapStyleRef.current = mapStyleId;
    setStyleReady(false);
    // Sprite replacement is not supported by Mapbox's style diff on every browser.
    map.setStyle(getMapStyleUrl(mapStyleId), { diff: false } as Parameters<
      MapboxMap['setStyle']
    >[1]);
  }, [mapStyleId]);

  useEffect(() => {
    const map = mapRef.current;

    if (!mapRegion || !map || restoredRegion.current) {
      return;
    }

    map.jumpTo({
      center: [mapRegion.longitude, mapRegion.latitude],
      zoom: useLocationStore.getState().mapZoom ?? regionToZoom(mapRegion),
      pitch: 0,
    });
    restoredRegion.current = true;
  }, [mapRegion]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !isOwnLocationVisible(location) ||
      focusRequestId === 0 ||
      consumedFocusRequestRef.current === focusRequestId ||
      !map ||
      !styleReady
    ) {
      return;
    }

    map.flyTo({
      center: [location.coordinates.longitude, location.coordinates.latitude],
      zoom: DEFAULT_MAP_ZOOM,
      pitch: 0,
      duration: 600,
    });
    consumedFocusRequestRef.current = focusRequestId;
  }, [focusRequestId, location, styleReady]);

  useEffect(() => {
    if (!styleReady) return;
    let previous = '';
    const update = () => {
      const shape = ownVesselToGeoJson(location);
      const serialized = JSON.stringify(shape);
      if (serialized === previous) return;
      const source = mapRef.current?.getSource(OWN_VESSEL_SOURCE_ID) as
        GeoJSONSource | undefined;
      if (source) {
        source.setData(shape);
        previous = serialized;
      }
    };
    update();
    const interval = setInterval(update, 1_000);
    return () => clearInterval(interval);
  }, [location, styleReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !styleReady) {
      return;
    }

    if (depthVisible && !map.getLayer(ENC_LAYER_ID)) {
      registerOverlaySlots(
        map,
        depthVisible,
        windVisible,
        depthMode,
        mapStyleId,
        windColorMode,
        vesselsVisible,
        fairwaysVisible,
        markersVisible,
        bridgesVisible,
      );
    }

    syncOverlayVisibility(map, {
      depthMode,
      depthVisible,
      windVisible,
      vesselsVisible,
      fairwaysVisible,
      markersVisible,
      bridgesVisible,
    });
  }, [
    bridgesVisible,
    depthMode,
    depthVisible,
    fairwaysVisible,
    mapStyleId,
    markersVisible,
    styleReady,
    vesselsVisible,
    windColorMode,
    windVisible,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !styleReady) {
      return;
    }

    WIND_PARTICLE_LAYER_IDS.forEach((layerId, bucket) => {
      if (map.getLayer(layerId)) {
        map.setPaintProperty(
          layerId,
          'line-gradient',
          windTrailGradient(
            windBucketColor(bucket as 0 | 1 | 2 | 3, mapStyleId, windColorMode),
          ) as unknown as mapboxgl.Expression,
        );
      }
    });
  }, [mapStyleId, styleReady, windColorMode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !styleReady || !windRenderingEnabled || !windField) {
      return;
    }

    const source = map.getSource(WIND_SOURCE_ID) as GeoJSONSource | undefined;

    if (!source) {
      return;
    }

    const spawnBounds = particleBoundsForRegion(windField, windRegion);
    let particles = createWindParticles(
      spawnBounds,
      windParticleCount(zoom, 300),
    );
    let lastUpdate = performance.now();
    let animationFrame = 0;
    let active = true;

    const animate = (now: number) => {
      if (!active) return;
      if (now - lastUpdate >= 100) {
        particles = advanceWindParticles(
          particles,
          windField,
          (now - lastUpdate) / 1_000,
          zoom,
          spawnBounds,
        );
        source.setData(particlesToGeoJson(particles, windField));
        lastUpdate = now;
      }

      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
    };
  }, [styleReady, windField, windRegion, windRenderingEnabled, zoom]);

  if (!accessToken) {
    return <div style={errorStyle}>{strings.mapTokenMissing}</div>;
  }

  return <div ref={containerRef} style={mapStyle} />;
}

const mapStyle = {
  width: '100%',
  height: '100%',
} as const;

const errorStyle = {
  display: 'flex',
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  boxSizing: 'border-box',
  backgroundColor: '#082f49',
  color: '#f0f9ff',
  fontFamily: 'Arial, sans-serif',
  textAlign: 'center',
} as const;
