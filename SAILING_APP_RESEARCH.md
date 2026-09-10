# Recreational Sailing App Research

Research date: 7 September 2026

## Executive Summary

Assuming Sail primarily targets Dutch recreational cruising sailors, users do
not mainly need more independent map layers. They need the available nautical
data translated into clear answers:

- Can I safely reach my destination?
- Which course or tack should I sail now?
- What weather, depth, bridge, tide, or closure will affect me?
- When will I arrive?
- Will the app still work without reception?
- Can someone ashore follow me or help if something goes wrong?

Sail already provides a useful situational-awareness map. Its next major step
should be route planning and active navigation, followed by sailing-specific
guidance, current Dutch waterway information, offline reliability, and safety
features.

## Current Position

Sail already has valuable foundations:

- Own-position display
- Current wind conditions and animated wind visualization
- AIS vessel traffic
- Fairways and indicative vessel suitability
- Buoys and beacons
- Partial bridge information
- ENC and historical bathymetry overlays
- Configurable vessel dimensions
- Responsive map interaction and object callouts

Major missing categories:

- Continuous navigation
- Routes and waypoints
- Tides, currents, and water levels
- Scheepvaartberichten and closures
- Deterministic offline charts
- Safety alarms
- Complete weather forecast UI
- Sailing performance guidance

## What Recreational Sailors Want

Feature convergence across Waterkaarten, Savvy Navvy, PredictWind, and OpenCPN
indicates these core expectations:

| Need                      | Expected features                                             |
| ------------------------- | ------------------------------------------------------------- |
| Simple planning           | Destination, waypoints, route, distance, and ETA              |
| Clear underway guidance   | COG, SOG, bearing, cross-track error, and next waypoint       |
| Current local information | Closures, bridge times, restrictions, and water levels        |
| Weather understanding     | Timeline, gusts, rain, waves, and warnings                    |
| Sailing decisions         | Wind angle, VMG, laylines, and tack recommendations           |
| Reliability               | Offline charts, stale-data labels, and GPS-quality indicators |
| Safety                    | AIS collision warnings, anchor alarm, MOB, and trip sharing   |
| Personalization           | Draft, air draft, beam, and vessel performance profile        |
| Interoperability          | GPX, NMEA, and Signal K                                       |

For the Netherlands specifically, Waterkaarten emphasizes routes, offline maps,
boat-dimension-aware routing, bridge and lock information, marinas, and current
Rijkswaterstaat notices.

KNRM reports that almost 15% of rescue responses involved navigation errors,
while more than a quarter involved engine problems. KNRM specifically
recommends route planning, current charts, bridge and lock information,
position sharing, and delay warnings.

## Highest-Priority Features

### 1. Active Navigation

This should be the next major product capability.

Add:

- Tap or long-press the map to set a destination
- Continuous GPS updates
- Course Over Ground (COG)
- Speed Over Ground (SOG)
- Bearing To Waypoint (BTW)
- Distance To Waypoint (DTW)
- Estimated Time of Arrival (ETA)
- Cross-track error (XTE)
- Arrival and off-course alerts
- A breadcrumb trail

The current location system requests a position but does not provide a complete
continuous navigation session.

### 2. Predicted Track

The proposed "estimated direction" feature is useful. Nautically, this is
normally presented as a COG/SOG projection vector.

Display a line showing where the vessel will be in, for example:

- 6 minutes
- 15 minutes
- 30 minutes

The basic calculation is:

```text
projected distance = SOG * selected time
projected direction = COG
```

Use a fading line or uncertainty cone. Label it as a projection rather than a
guaranteed route.

### 3. Wind Guidance

Do not implement "best direction for wind" as one unexplained arrow. Several
different nautical concepts are involved.

An initial wind panel should show:

- Forecast wind direction and speed
- Relative wind angle to the current COG
- Relative wind angle to the destination
- Current port or starboard tack
- The no-go zone
- Suggested close-hauled headings
- VMG toward the destination

Example:

```text
Wind from 270 degrees
Destination bearing 285 degrees
Suggested headings: 225 degrees or 315 degrees
Current tack: starboard
VMG toward destination: 3.8 kn
```

A phone-only implementation can combine GPS with forecast wind, but it should
be labelled **estimated wind guidance**. Forecast wind is not the same as true
wind measured at the vessel.

### 4. Laylines

Laylines provide the clearest visual answer to "which direction should I
sail?"

Start with:

- A configurable upwind angle, initially around 40-50 degrees
- Port and starboard laylines
- Suggested tack
- Estimated distance and time on each tack
- A simple tack-point calculation

Later improve this using:

- A boat-specific polar
- Current and tide
- Leeway
- Wind changes along the route
- Wave conditions

Without those later inputs, describe the result as indicative rather than
optimal.

### 5. Velocity Made Good

Two different VMG values are useful:

- **VMG to waypoint:** progress toward the destination
- **VMG to wind:** upwind or downwind sailing performance

Basic waypoint VMG:

```text
VMG = SOG * cos(COG - bearing to waypoint)
```

This tells sailors whether sailing faster in a less direct direction is
actually improving progress toward the destination.

### 6. Weather Timeline

Sail already downloads hourly forecast information, including gusts and
precipitation, but currently shows only current conditions.

Expose:

- Hourly wind speed
- Gusts
- Wind direction
- Rain probability
- Temperature
- Forecast age
- A time slider controlling the wind layer
- Expected conditions at ETA

This is a relatively accessible improvement because much of the underlying
data model already exists.

### 7. Water Levels, Tides, and Currents

Rijkswaterstaat publishes current and forecast water information, including:

- Water levels
- Current speed and direction
- Wave height
- Wind observations

Combine these values with the saved vessel profile:

```text
estimated water depth = current water level - bottom elevation
```

```text
estimated under-keel clearance =
  estimated water depth - vessel draft - safety margin
```

Also calculate estimated bridge clearance using air draft. Every result must
show its station, observation time, source, uncertainty, and configured safety
margin.

### 8. Notices and Closures

Integrate Rijkswaterstaat or European Notices to Skippers:

- Waterway closures
- Bridge and lock failures
- Works
- Temporary restrictions
- Changed operating times
- Events and obstruction warnings
- Notices intersecting a planned route

Rijkswaterstaat describes this as essential information and publishes
unexpected disruptions through Vaarweginformatie, often within one hour.

### 9. Offline Navigation

Reliable offline operation is a baseline expectation for a navigation app.

Add:

- Downloadable map regions
- Route-corridor downloads
- Offline chart version and age
- Offline notices and bridge information
- A forecast package for the planned trip
- A visible downloaded-area boundary
- A pre-departure "ready for offline trip" check

The current caches offer graceful degradation, but do not guarantee that all
required charts are available.

### 10. Safety Features

Recommended order:

1. GPS loss or stale-position warning
2. Man Overboard button
3. Anchor alarm
4. Trip plan and live position sharing
5. Delay or overdue warning
6. AIS CPA/TCPA collision warnings
7. Shallow-water warning
8. Air-draft and bridge warning
9. Weather-warning notifications

AIS CPA/TCPA should only be added after reliable continuous own-position, COG,
and SOG data are available.

## Recommended Roadmap

### Phase 1: Navigation Core

- Continuous GPS
- COG and SOG
- Destination selection
- Bearing, distance, and ETA
- Predicted track line
- Breadcrumb trail
- Basic arrival and off-course alerts

### Phase 2: Sailing Assistant

- Wind compass
- Relative wind angle
- Configurable no-go angle
- Port and starboard laylines
- VMG to waypoint
- Indicative tack recommendation

### Phase 3: Dutch Passage Planning

- Manual waypoints and routes
- Rijkswaterstaat notices
- Complete bridge and lock information
- Water levels and currents
- Route warnings based on vessel dimensions
- Weather at each route leg and ETA

### Phase 4: Reliability and Safety

- Offline route packages
- Anchor alarm
- MOB workflow
- Position sharing and overdue alerts
- CPA/TCPA
- GPX import and export

### Phase 5: Advanced Routing

- Boat polars
- Current- and tide-corrected Course To Steer
- Departure-time comparison
- Weather routing
- NMEA and Signal K integration
- Learned vessel performance

## Recommended First User Flow

Build this coherent interaction before adding more standalone layers:

1. The user long-presses the map and selects **Navigeer hier**.
2. Sail starts continuous GPS tracking.
3. A compact navigation strip shows SOG, COG, BTW, distance, and ETA.
4. The map displays a COG projection line.
5. Wind-relative laylines show plausible port and starboard headings.
6. Sail labels the result as guidance based on forecast wind.
7. A time slider shows how wind and gusts may change before arrival.

## Features to Defer

These are lower priority until navigation fundamentals work reliably:

- AI-generated polars
- Social reviews and photos
- Global chart coverage
- Autopilot control
- 3D charts
- Racing start-line tools
- Gamification

## Product and Safety Notes

- Historical bottom elevation is not the same as current navigable depth.
- Forecast wind is not measured true or apparent wind at the vessel.
- AIS can be delayed, incomplete, or absent and does not replace a lookout.
- Planned bridge openings should not be presented as confirmed live openings.
- Indicative CEMT suitability does not prove that a route is passable.
- Navigation guidance should always show source freshness and uncertainty.
- Sail should remain explicitly described as a supplementary navigation aid
  until authoritative charts, updates, offline coverage, and safety workflows
  are mature.

## Sources

- [Waterkaarten feature overview](https://waterkaarten.app/ontdek-waterkaarten/)
- [Savvy Navvy feature overview](https://www.savvy-navvy.com/)
- [PredictWind features](https://www.predictwind.com/features)
- [PredictWind weather routing](https://www.predictwind.com/features/weather-routing)
- [PredictWind boat polars](https://www.predictwind.com/features/ai-polars)
- [OpenCPN capabilities](https://opencpn.org/OpenCPN/info/about.html)
- [KNRM navigation incident and preparation guidance](https://www.knrm.nl/blog/tips/goede-voorbereiding-voorkomt-veel-problemen-op-het-water)
- [KNRM prevention and KNRM Helpt](https://www.knrm.nl/helpt)
- [RYA weather and tides guidance](https://www.rya.org.uk/water-safety/weather-and-tides)
- [RYA passage planning guidance](https://www.rya.org.uk/water-safety/passage-planning-and-navigation)
- [Rijkswaterstaat water data](https://www.rijkswaterstaat.nl/water/waterdata)
- [Rijkswaterstaat scheepvaartberichten](https://www.rijkswaterstaat.nl/water/scheepvaart/scheepvaartberichten)
