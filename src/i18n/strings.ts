export const strings = {
  appName: 'Sail',
  setupMessage: 'De navigatiekaart wordt voorbereid.',
  locationRationale:
    'Je locatie wordt gebruikt om je positie op de kaart te tonen.',
  requestLocation: 'Bepaal mijn locatie',
  requestingLocation: 'Locatie bepalen...',
  locationUnavailable: 'Je locatie kon niet worden bepaald.',
  currentLocation: 'Huidige locatie',
  developmentLocation: 'Ontwikkellocatie',
  developmentLocationDetails:
    'GPS is niet beschikbaar. Er wordt een testpositie op het IJsselmeer gebruikt.',
  coordinates: (latitude: number, longitude: number) =>
    `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  mapTokenMissing:
    'De kaart kan niet worden geladen omdat de Mapbox-token ontbreekt.',
  windLayer: 'Wind',
  windColors: 'Windkleuren',
  windSpeedColors: 'Windsnelheid',
  windContrastColor: 'Hoog contrast',
  bathymetryLayer: 'Bodem',
  mapStyle: 'Kaartstijl',
  modernMapStyle: 'Nautisch',
  traditionalMapStyle: 'Klassiek',
  darkMapStyle: 'Nacht',
  satelliteMapStyle: 'Satelliet',
  weatherUnavailable: 'Windgegevens zijn tijdelijk niet beschikbaar.',
  weatherLoading: 'Wind laden...',
  cachedData: 'cache',
  weatherSource: 'Open-Meteo / KNMI',
  windZoomIn: 'Zoom verder in om windstromen te zien.',
  windFieldLoading: 'Windstromen laden...',
  windFieldUnavailable: 'Windanimatie is tijdelijk niet beschikbaar.',
  windFieldStale: 'Windanimatie gebruikt eerder geladen gegevens.',
  bathymetryNotice:
    'Bodemhoogte t.o.v. NAP van Rijkswaterstaat. Niet gebruiken als actuele vaardiepte.',
} as const;
