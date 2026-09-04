# Project Plan

## Current Status

- Active phase: Phase J — Live AIS Traffic (implemented and verified)
- Phase F — Wind Animation is complete.
- Mapbox Studio nautical basemap styling is deferred until the developer is ready.
- Phases G and H are implemented, tested, and reviewed.
- Phase I is implemented and awaiting review.

### Phase G Verification

- The depth toggle provides two persisted, mutually exclusive modes: the official Rijkswaterstaat Inland ENC WMS layer `2` (`Depths, currents, etc`) and measured NAP bathymetry.
- Artificial sampled polygons and cell outlines have been removed from web and native rendering.
- Bathymetry uses only the nationwide 20 m WMS from zoom 8 through 11 and switches exclusively to the February 2026 1 m snapshot from zoom 12. ENC and bathymetry never render together.
- WMS rasters use matching 512 px requests and source tiles with no raster fade, reducing requests and preventing stale parent imagery from overlapping a replacement layer.
- Automatic viewport sampling, generated NAP sounding labels, and the persisted depth viewport cache have been removed. In bathymetry mode, tapping the visible layer makes one non-retried `GetFeatureInfo` request against the dataset shown at the current zoom.
- First launch and location focus use Mapbox zoom 13. Returning sessions continue to restore the operator's last viewport; Garmin documents manual chart scale and speed-based look-ahead but no fixed idle or startup chart scale.
- All 58 unit tests, TypeScript, ESLint, Prettier, and the production web export pass. Native visual rendering remains unverified on Linux.
- ENC capabilities were verified through an alternate fetch path, including layer `2`, transparent PNG, EPSG:3857, and published bounds. The same path verified that the live 1 m WMS currently ends at February 2026; later catalog metadata is not yet present in the service. WMS raster requests use blank-image exceptions so service errors are not decoded as map images. Direct live tiles and numeric sampling could not be verified from the development host because the official Rijkswaterstaat GeoWeb endpoints timed out. Native visual rendering remains unverified on this Linux development host.

## Authoritative Phases

Work through these phases sequentially. After each phase, run and verify in Expo Web before moving on, and summarize what was built plus anything that couldn't be verified on web.

### Phase A — Project Setup

Scaffold Expo + TypeScript project, install the dependency list in section 3.
Set up the folder structure in section 7 with placeholder index files.
Configure tsconfig.json with path aliases (@/components, @/services, etc.).
Configure ESLint + Prettier.
Confirm npx expo start --web runs a blank app successfully before continuing.

### Phase B — Core Types & State

Define all TypeScript types (Weather, Location, Waypoint, depth samples, MapRegion).
Implement Zustand stores with persist (AsyncStorage) for weather, location, layers, and settings.

### Phase C — Location

Implement LocationService with a web-compatible path (navigator.geolocation on web, native module on iOS/Android) behind one interface.
Implement useLocation hook.
Add nautical-mile distance and bearing utility functions with unit tests.

### Phase D — Base Map

Implement the map screen with react-native-maps, centered on Dutch waters, current-location marker, and correct display settings per section 5.1.
Verify pan/zoom/rotate works; note any web limitation of react-native-maps and implement/flag a fallback.

### Phase E — Weather/Wind Data Layer

Implement KNMIService, OpenMeteoService, OpenWeatherMapService behind a shared WeatherService interface with automatic fallback and AsyncStorage caching.
Implement the basic weather panel UI.

### Phase F — Wind Animation

Implement the animated wind overlay (SVG/Reanimated particle field) driven by the weather service data, toggle-able via the layer menu.

### Phase G — Depth Layer

Implement RijkswaterstaatService for bathymetric/depth data.
Implement the colored depth-zone overlay with numeric labels and legend.

### Phase H — Layer Menu

Build the toggleable layer menu UI connecting to layersStore, wiring each overlay's visibility to its toggle.

Phase H implementation:

- The map panel now uses a dedicated `LayerMenu` component.
- The menu fills the available phone width up to a 380 px tablet cap, uses two-column touch targets with wrapping labels, and scrolls within the available screen height.
- Wind and depth remain functional and persist through `layersStore`.
- Tides, waypoints, and weather warnings are presented as disabled Dutch placeholders until their overlays are implemented.
- All 61 unit tests, TypeScript, ESLint, Prettier, and the production web export pass. Visual review remains pending.

### Phase I — Offline & Polish

Verify offline behavior (airplane mode / cache-only) for weather and depth data, with a visible "last updated" / stale-data indicator.
General QA pass against the Definition of Done below.

Phase I implementation:

- Expo-compatible NetInfo monitors connectivity on Android, iOS, and web.
- Weather remains persisted in AsyncStorage, refreshes at the 15-minute freshness boundary, and reports its update timestamp plus cache, stale, or offline state in Dutch.
- A failed weather refresh retains the last successful forecast instead of replacing it with an empty error state.
- Wind-field requests pause offline; an already loaded in-memory field remains available and is explicitly marked as such.
- Depth point inspection is disabled offline. Mapbox-managed cached raster tiles may remain visible and the UI clearly describes this best-effort behavior; numeric depth results are not persisted.
- All 67 unit tests, TypeScript, ESLint, Prettier, and the production web export pass. Visual offline review and native rendering remain pending.

### Phase J — Live AIS Traffic

Add a persisted `Andere schepen` layer backed by a provider-neutral AIS service.
Keep reports in memory, scope subscriptions to the map viewport, and render
selectable heading/course-oriented vessel markers on web and native.

Phase J implementation:

- A generic `AISService` interface isolates connection, status, and vessel
  updates from AISStream-specific message normalization.
- A server-side WebSocket relay protects `AISSTREAM_API_KEY`, keeps one upstream
  provider connection, combines client viewport subscriptions, and filters
  reports per client. Direct Expo Web access is intentionally not used because
  AISStream forbids browser connections and public API keys.
- The app batches MMSI-keyed updates once per second, retains static vessel
  metadata, expires reports after 15 minutes, and never persists live traffic.
- Web and native maps use the same GeoJSON vessel data and show selectable,
  heading/course-oriented markers. The Dutch details panel includes name,
  MMSI, speed, course, and ship type when broadcast.
- All 77 unit tests, TypeScript, ESLint, Prettier, and the production web export
  pass. A live relay check received an AISStream subscription confirmation and
  five position reports within seconds. Native visual rendering remains
  unverified on this Linux development host.

## Definition of Done

A feature is done when: it's implemented in TypeScript with no any escapes, it works in Expo Web (or has a documented, justified native-only exception), it has sensible error handling for API failures (never a blank/crashed screen), it uses cached data gracefully when offline, and UI text is in Dutch.

## Deferred Work

- Mapbox Studio modern nautical, traditional chart, and dark marine hosted styles.
- Phase E provider-chain gap: dedicated KNMI and OpenWeatherMap fallback services.
- Phase 2 and Phase 3 backlog from the product specification.
