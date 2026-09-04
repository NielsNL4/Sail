# Development

## Environment

Create a local `.env` file. It is ignored by Git.

```dotenv
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_public_token
MAPBOX_DOWNLOADS_TOKEN=sk.your_secret_downloads_token
# Optional custom Mapbox Studio style URLs:
EXPO_PUBLIC_MAPBOX_STYLE_MODERN=mapbox://styles/your-account/your-modern-style
EXPO_PUBLIC_MAPBOX_STYLE_TRADITIONAL=mapbox://styles/your-account/your-traditional-style
EXPO_PUBLIC_MAPBOX_STYLE_DARK=mapbox://styles/your-account/your-dark-style
```

Generate both tokens at https://console.mapbox.com/account/access-tokens/.

- `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` is the public runtime token used by web,
  iOS, and Android. It is embedded in application bundles by design.
- `MAPBOX_DOWNLOADS_TOKEN` is a secret token with the `DOWNLOADS:READ` scope.
  It is used only while native Mapbox dependencies are installed. Never expose
  it through an `EXPO_PUBLIC_` variable or commit it.

`app.config.js` maps `MAPBOX_DOWNLOADS_TOKEN` to the environment variable name
expected by the current `@rnmapbox/maps` native installer. The secret is not
stored in the Expo config.

The map defaults to a modern nautical-oriented Mapbox navigation style. The
traditional, dark, and satellite styles can be selected from the map. Add the
optional Mapbox Studio URLs above to replace the built-in modern, traditional,
and dark fallbacks with Sail-specific cartography; satellite remains an
optional Mapbox layer.

## Web

Web development uses `mapbox-gl` directly and does not require prebuild or a
native development client.

```sh
npm run web
```

Open the URL printed by Expo, normally http://localhost:8081.

## Native

`@rnmapbox/maps` contains custom native code and does not run in Expo Go. After
installing dependencies or changing native config plugins, generate and run a
local development build:

```sh
npx expo prebuild
npx expo run:android
```

On macOS, iOS can be run instead:

```sh
npx expo prebuild
npx expo run:ios
```

Subsequent JavaScript-only changes can use `npx expo start --dev-client`
without another prebuild. An EAS development build is also possible later, but
is not required for the current local development workflow.

## Data Providers

- Wind and weather use Open-Meteo's `knmi_seamless` model with sea grid-cell
  selection. Open-Meteo provides and normalizes the KNMI HARMONIE forecast. A
  viewport grid is converted into animated particle trails on the client; the
  animation is a visualization and particles move faster than physical scale.
  Particles appear from zoom level 8. Their density, geographic speed, trail
  length, and forecast grid resolution adapt to zoom so local direction changes
  remain visible. Rendering uses a fixed particle pool and four pooled
  `MultiLineString` speed buckets, capped at 300 trails on web and 200 on native.
  Mapbox applies the fading tails on the GPU. Trails grow in and shrink toward
  their moving head over 1.2 seconds instead of appearing or disappearing
  abruptly. Geometry updates run at 10 Hz and particles outside the padded
  viewport are recycled. The active field refreshes every 15 minutes. Wind
  colors can show speed or use a high-contrast palette selected for the active
  basemap.
- The depth overlay has two persisted, mutually exclusive Rijkswaterstaat CC0
  modes. `Nautische ENC` shows only Inland ENC Maritime Chart Service layer `2`
  (`Depths, currents, etc`). `Bodemhoogte NAP` shows the nationwide
  `bodemhoogte_20mtr` WMS from zoom 8 through 11 and switches exclusively to the
  February 2026 `bodemhoogte_1mtr_202602` snapshot from zoom 12. The dated 1 m
  layer must be updated when Rijkswaterstaat publishes a newer snapshot.
- WMS sources request and declare 512 px tiles. Raster fading is disabled so a
  stale parent tile cannot overlap the active resolution during zoom changes.
  Automatic viewport sampling, generated sounding labels, and persisted depth
  viewport data are intentionally omitted to keep network traffic bounded.
- In bathymetry mode, tapping the visible layer makes one non-retried WMS
  GetFeatureInfo request against the resolution shown at the current zoom and
  reports bottom elevation in metres relative to NAP. Point inspection is not
  available in ENC mode to avoid mixing NAP measurements with chart-datum data.

Bathymetry is historic measured bottom elevation, not live navigable depth. It
must not be used without current water level, chart datum, vessel draft, and
safety-margin corrections.

API failures are normalized before reaching the UI. On web, non-cancellation
failures are written to the browser console as safe structured metadata without
request headers, tokens, URLs, or response payloads.
