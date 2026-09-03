import type {
  MapRegion,
  MapStyleId,
  WindColorMode,
  WindField,
  WindFieldBounds,
} from '@/types';

const METERS_PER_LATITUDE_DEGREE = 111_320;
export const WIND_PARTICLE_FADE_STEPS = 12;
export const MIN_WIND_PARTICLE_ZOOM = 8;

export function shouldRenderWindParticles(zoom: number): boolean {
  return Number.isFinite(zoom) && zoom >= MIN_WIND_PARTICLE_ZOOM;
}

export interface WindParticle {
  latitude: number;
  longitude: number;
  trail: GeoJSON.Position[];
  age: number;
  maxAge: number;
}

export function windParticleSpeedScale(zoom: number): number {
  return Math.max(1, 700 / 2 ** (zoom - MIN_WIND_PARTICLE_ZOOM));
}

export function windParticleTrailLength(zoom: number): number {
  return Math.min(16, Math.max(10, Math.round(zoom)));
}

export function windParticleCount(zoom: number, maximum: number): number {
  const minimum = Math.round(maximum * 0.2);
  const zoomProgress = Math.min(
    1,
    Math.max(0, (zoom - MIN_WIND_PARTICLE_ZOOM) / 10),
  );

  return Math.round(minimum + (maximum - minimum) * zoomProgress ** 1.15);
}

interface InterpolatedWind {
  eastwardMetersPerSecond: number;
  northwardMetersPerSecond: number;
  speedMetersPerSecond: number;
}

function interpolate(a: number, b: number, ratio: number): number {
  return a + (b - a) * ratio;
}

export function windAt(
  field: WindField,
  longitude: number,
  latitude: number,
): InterpolatedWind | null {
  const { bounds, columns, rows, vectors } = field;

  if (
    longitude < bounds.west ||
    longitude > bounds.east ||
    latitude < bounds.south ||
    latitude > bounds.north
  ) {
    return null;
  }

  const gridX =
    ((longitude - bounds.west) / (bounds.east - bounds.west)) * (columns - 1);
  const gridY =
    ((latitude - bounds.south) / (bounds.north - bounds.south)) * (rows - 1);
  const left = Math.floor(gridX);
  const right = Math.min(left + 1, columns - 1);
  const bottom = Math.floor(gridY);
  const top = Math.min(bottom + 1, rows - 1);
  const xRatio = gridX - left;
  const yRatio = gridY - bottom;

  const valueAt = (row: number, column: number, key: keyof InterpolatedWind) =>
    vectors[row * columns + column][key];
  const interpolateProperty = (key: keyof InterpolatedWind) => {
    const bottomValue = interpolate(
      valueAt(bottom, left, key),
      valueAt(bottom, right, key),
      xRatio,
    );
    const topValue = interpolate(
      valueAt(top, left, key),
      valueAt(top, right, key),
      xRatio,
    );

    return interpolate(bottomValue, topValue, yRatio);
  };

  return {
    eastwardMetersPerSecond: interpolateProperty('eastwardMetersPerSecond'),
    northwardMetersPerSecond: interpolateProperty('northwardMetersPerSecond'),
    speedMetersPerSecond: interpolateProperty('speedMetersPerSecond'),
  };
}

export function particleBoundsForRegion(
  field: WindField,
  region: MapRegion,
): WindFieldBounds {
  const longitudePadding = region.longitudeDelta * 0.1;
  const latitudePadding = region.latitudeDelta * 0.1;
  const bounds = {
    west: Math.max(
      field.bounds.west,
      region.longitude - region.longitudeDelta / 2 - longitudePadding,
    ),
    east: Math.min(
      field.bounds.east,
      region.longitude + region.longitudeDelta / 2 + longitudePadding,
    ),
    south: Math.max(
      field.bounds.south,
      region.latitude - region.latitudeDelta / 2 - latitudePadding,
    ),
    north: Math.min(
      field.bounds.north,
      region.latitude + region.latitudeDelta / 2 + latitudePadding,
    ),
  };

  if (bounds.west >= bounds.east || bounds.south >= bounds.north) {
    return field.bounds;
  }

  return bounds;
}

function resetParticle(
  bounds: WindFieldBounds,
  random: () => number,
): WindParticle {
  const longitude = interpolate(bounds.west, bounds.east, random());
  const latitude = interpolate(bounds.south, bounds.north, random());

  return {
    latitude,
    longitude,
    trail: [[longitude, latitude]],
    age: 0,
    maxAge: 25 + Math.floor(random() * 50),
  };
}

function resetExistingParticle(
  particle: WindParticle,
  bounds: WindFieldBounds,
  random: () => number,
) {
  const longitude = interpolate(bounds.west, bounds.east, random());
  const latitude = interpolate(bounds.south, bounds.north, random());

  particle.latitude = latitude;
  particle.longitude = longitude;
  particle.trail.length = 1;
  particle.trail[0] = [longitude, latitude];
  particle.age = 0;
  particle.maxAge = 25 + Math.floor(random() * 50);
}

export function createWindParticles(
  bounds: WindFieldBounds,
  count: number,
  random = Math.random,
): WindParticle[] {
  return Array.from({ length: count }, () => resetParticle(bounds, random));
}

export function advanceWindParticles(
  particles: WindParticle[],
  field: WindField,
  deltaSeconds: number,
  zoom: number,
  spawnBounds: WindFieldBounds,
  random = Math.random,
): WindParticle[] {
  const elapsedSeconds = Math.min(Math.max(deltaSeconds, 0), 0.25);
  const visualSpeedScale = windParticleSpeedScale(zoom);

  for (const particle of particles) {
    const wind = windAt(field, particle.longitude, particle.latitude);

    if (!wind || particle.age >= particle.maxAge) {
      resetExistingParticle(particle, spawnBounds, random);
      continue;
    }

    const latitudeDelta =
      (wind.northwardMetersPerSecond * elapsedSeconds * visualSpeedScale) /
      METERS_PER_LATITUDE_DEGREE;
    const longitudeScale = Math.max(
      Math.cos((particle.latitude * Math.PI) / 180),
      0.1,
    );
    const longitudeDelta =
      (wind.eastwardMetersPerSecond * elapsedSeconds * visualSpeedScale) /
      (METERS_PER_LATITUDE_DEGREE * longitudeScale);
    const latitude = particle.latitude + latitudeDelta;
    const longitude = particle.longitude + longitudeDelta;

    if (
      latitude < spawnBounds.south ||
      latitude > spawnBounds.north ||
      longitude < spawnBounds.west ||
      longitude > spawnBounds.east
    ) {
      resetExistingParticle(particle, spawnBounds, random);
      continue;
    }

    particle.latitude = latitude;
    particle.longitude = longitude;
    particle.trail.push([longitude, latitude]);
    if (particle.trail.length > windParticleTrailLength(zoom)) {
      particle.trail.shift();
    }
    particle.age += 1;
  }

  return particles;
}

const windPalettes: Record<
  MapStyleId,
  { contrast: string; speed: [string, string, string, string] }
> = {
  modern: {
    contrast: '#082f49',
    speed: ['#075985', '#0284c7', '#f59e0b', '#e11d48'],
  },
  traditional: {
    contrast: '#172554',
    speed: ['#1e3a8a', '#0369a1', '#c2410c', '#be123c'],
  },
  dark: {
    contrast: '#e0f2fe',
    speed: ['#e0f2fe', '#22d3ee', '#fde047', '#fb7185'],
  },
  satellite: {
    contrast: '#ffffff',
    speed: ['#ffffff', '#67e8f9', '#fde047', '#fb7185'],
  },
};

function hexToRgb(color: string): [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ];
}

export function windSpeedBucket(speed: number): 0 | 1 | 2 | 3 {
  if (speed < 8) return 0;
  if (speed < 16) return 1;
  if (speed < 25) return 2;
  return 3;
}

export function windBucketColor(
  bucket: 0 | 1 | 2 | 3,
  mapStyle: MapStyleId,
  colorMode: WindColorMode,
): string {
  const palette = windPalettes[mapStyle];

  return colorMode === 'contrast' ? palette.contrast : palette.speed[bucket];
}

export function windTrailGradient(color: string) {
  const [red, green, blue] = hexToRgb(color);

  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    0,
    `rgba(${red}, ${green}, ${blue}, 0)`,
    0.35,
    `rgba(${red}, ${green}, ${blue}, 0.12)`,
    0.72,
    `rgba(${red}, ${green}, ${blue}, 0.55)`,
    1,
    `rgba(${red}, ${green}, ${blue}, 1)`,
  ] as const;
}

export interface WindTrailProperties {
  bucket: 0 | 1 | 2 | 3;
}

export function particleTrailForLifecycle(
  particle: WindParticle,
): GeoJSON.Position[] {
  const fadeInProgress = Math.min(1, particle.age / WIND_PARTICLE_FADE_STEPS);
  const fadeOutProgress = Math.min(
    1,
    (particle.maxAge - particle.age) / WIND_PARTICLE_FADE_STEPS,
  );
  const visibleProgress = Math.max(
    0,
    Math.min(fadeInProgress, fadeOutProgress),
  );
  const visiblePointCount = Math.min(
    particle.trail.length,
    Math.max(2, Math.ceil(particle.trail.length * visibleProgress)),
  );

  if (visiblePointCount >= particle.trail.length) {
    return particle.trail;
  }

  return particle.trail.slice(-visiblePointCount);
}

export function particlesToGeoJson(
  particles: WindParticle[],
  field: WindField,
): GeoJSON.FeatureCollection<GeoJSON.MultiLineString, WindTrailProperties> {
  const coordinates: GeoJSON.Position[][][] = [[], [], [], []];

  for (const particle of particles) {
    if (particle.age === 0 || particle.trail.length < 2) {
      continue;
    }

    const wind = windAt(field, particle.longitude, particle.latitude);

    if (wind) {
      coordinates[windSpeedBucket(wind.speedMetersPerSecond)].push(
        particleTrailForLifecycle(particle),
      );
    }
  }

  return {
    type: 'FeatureCollection',
    features: coordinates.map((bucketCoordinates, bucket) => ({
      type: 'Feature',
      properties: { bucket: bucket as 0 | 1 | 2 | 3 },
      geometry: {
        type: 'MultiLineString',
        coordinates: bucketCoordinates,
      },
    })),
  };
}

export const EMPTY_WIND_PARTICLES: GeoJSON.FeatureCollection<
  GeoJSON.MultiLineString,
  WindTrailProperties
> = {
  type: 'FeatureCollection',
  features: [],
};
