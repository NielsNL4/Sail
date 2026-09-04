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

import type { BaseMapProps } from './BaseMap.types';
import { getOverlayLayerVisibility } from './mapLayerVisibility';
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
}

export default function BaseMap({
  initialRegion,
  location,
  focusRequestId,
  locationTitle,
  depthMode,
  depthVisible,
  windVisible,
  mapStyle: mapStyleId,
  windColorMode,
  networkAvailable,
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
  const markerRef = useRef<mapboxgl.Marker | null>(null);
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
  const setMapRegion = useLocationStore((state) => state.setMapRegion);
  const setMapZoom = useLocationStore((state) => state.setMapZoom);
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
  const handleMapPress = useEffectEvent(() => {
    onMapPress();
  });
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
      setMapZoom(nextZoom);
      setMapRegion(
        coordinatesToRegion(
          [center.lng, center.lat],
          [bounds.getEast(), bounds.getNorth()],
          [bounds.getWest(), bounds.getSouth()],
        ),
      );
    });
    map.on('click', (event) => {
      const point = { x: event.point.x, y: event.point.y };
      const coordinates = {
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      };
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
      handleMapPress();
      handleDepthPress(coordinates, map.getZoom(), point);
    });
    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, [
    initialMapStyle,
    initialRegion,
    initialViewport,
    initialZoom,
    setMapRegion,
    setMapZoom,
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

    if (!location || focusRequestId === 0 || !map) {
      return;
    }

    map.flyTo({
      center: [location.coordinates.longitude, location.coordinates.latitude],
      zoom: DEFAULT_MAP_ZOOM,
      pitch: 0,
      duration: 600,
    });
  }, [focusRequestId, location]);

  useEffect(() => {
    markerRef.current?.remove();
    markerRef.current = null;

    if (!location || !mapRef.current) {
      return;
    }

    const markerElement = document.createElement('div');
    markerElement.setAttribute('aria-label', locationTitle);
    markerElement.setAttribute('role', 'img');
    markerElement.style.width = '18px';
    markerElement.style.height = '18px';
    markerElement.style.border = '3px solid #ffffff';
    markerElement.style.borderRadius = '50%';
    markerElement.style.backgroundColor = location.isMocked
      ? '#f59e0b'
      : '#0284c7';
    markerElement.style.boxShadow = '0 1px 5px rgba(8, 47, 73, 0.45)';

    markerRef.current = new mapboxgl.Marker({ element: markerElement })
      .setLngLat([
        location.coordinates.longitude,
        location.coordinates.latitude,
      ])
      .addTo(mapRef.current);
  }, [location, locationTitle]);

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
