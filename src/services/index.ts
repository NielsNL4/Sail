export {
  locationService,
  type LocationResult,
  type LocationService,
} from './LocationService';
export {
  createWeatherService,
  normalizeOpenMeteoResponse,
  weatherService,
  type WeatherService,
} from './WeatherService';
export {
  createWindFieldService,
  createWindGrid,
  normalizeWindField,
  windFieldGridSizeForZoom,
  windFieldService,
  windToVector,
  type WindFieldService,
} from './WindFieldService';
export {
  ApiError,
  normalizeApiError,
  type ApiErrorContext,
  type ApiErrorKind,
} from './ApiError';
export {
  createRijkswaterstaatService,
  parseDepthSample,
  rijkswaterstaatService,
  type RijkswaterstaatService,
} from './RijkswaterstaatService';
export {
  aisService,
  createAISService,
  normalizeAISMessage,
  type AISService,
} from './AISService';
export {
  createFairwayNetworkService,
  fairwayNetworkService,
  parseCemtClass,
  type FairwayNetworkService,
} from './FairwayNetworkService';
export {
  createNavigationMarkersService,
  navigationMarkersService,
  type NavigationMarkersService,
} from './NavigationMarkersService';
export {
  bridgeLockService,
  createBridgeLockService,
  type BridgeLockProviderStatus,
  type BridgeLockService,
} from './BridgeLockService';
