export { distanceInNauticalMiles, initialBearingDegrees } from './coordinates';
export {
  formatDataTimestamp,
  isTimestampStale,
  WEATHER_FRESHNESS_MS,
} from './freshness';
export {
  DEFAULT_MAP_ZOOM,
  DEPTH_DETAIL_ZOOM,
  DUTCH_WATERS_REGION,
  MIN_MARKER_ZOOM,
} from './constants';
export {
  directionToCompass,
  formatTemperature,
  formatWindSpeed,
} from './weather';
export { logApiError } from './logger';
export { regionToAISBoundingBox, shipTypeLabel } from './vessels';
export { feetToMeters, metersToFeet } from './vesselUnits';
export { fairwayIsUnsuitable, vesselProfileIsEmpty } from './vesselSuitability';
export { isPhoneLayout, PHONE_LAYOUT_MAX_WIDTH } from './responsive';
