import { describe, expect, it } from 'vitest';

import type { WindField } from '@/types';

import {
  advanceWindParticles,
  createWindParticles,
  particleBoundsForRegion,
  particleTrailForLifecycle,
  particlesToGeoJson,
  shouldRenderWindParticles,
  windAt,
  windBucketColor,
  windParticleSpeedScale,
  windParticleTrailLength,
  windParticleCount,
  windSpeedBucket,
  windTrailGradient,
  WIND_PARTICLE_FADE_STEPS,
} from './windParticles';

const field: WindField = {
  bounds: { west: 4, south: 52, east: 6, north: 54 },
  columns: 2,
  rows: 2,
  vectors: [
    {
      coordinates: { latitude: 52, longitude: 4 },
      eastwardMetersPerSecond: 0,
      northwardMetersPerSecond: 0,
      speedMetersPerSecond: 0,
    },
    {
      coordinates: { latitude: 52, longitude: 6 },
      eastwardMetersPerSecond: 10,
      northwardMetersPerSecond: 0,
      speedMetersPerSecond: 10,
    },
    {
      coordinates: { latitude: 54, longitude: 4 },
      eastwardMetersPerSecond: 0,
      northwardMetersPerSecond: 10,
      speedMetersPerSecond: 10,
    },
    {
      coordinates: { latitude: 54, longitude: 6 },
      eastwardMetersPerSecond: 10,
      northwardMetersPerSecond: 10,
      speedMetersPerSecond: 20,
    },
  ],
  validAt: '2026-09-03T12:00:00.000Z',
  fetchedAt: '2026-09-03T12:00:00.000Z',
  provider: 'open-meteo',
};

describe('wind particles', () => {
  it('bilinearly interpolates the wind grid', () => {
    expect(windAt(field, 5, 53)).toEqual({
      eastwardMetersPerSecond: 5,
      northwardMetersPerSecond: 5,
      speedMetersPerSecond: 10,
    });
    expect(windAt(field, 7, 53)).toBeNull();
  });

  it('creates particles inside the field bounds', () => {
    const particles = createWindParticles(field.bounds, 2, () => 0.5);

    expect(particles).toHaveLength(2);
    expect(particles[0]).toMatchObject({ latitude: 53, longitude: 5 });
  });

  it('advects particles and creates line features', () => {
    const [particle] = createWindParticles(field.bounds, 1, () => 0.5);
    const initialLatitude = particle.latitude;
    const initialLongitude = particle.longitude;
    const particles = [particle];
    const [advanced] = advanceWindParticles(
      particles,
      field,
      0.1,
      10,
      field.bounds,
      () => 0.5,
    );
    const geoJson = particlesToGeoJson([advanced], field);

    expect(advanced.latitude).toBeGreaterThan(initialLatitude);
    expect(advanced.longitude).toBeGreaterThan(initialLongitude);
    expect(advanced).toBe(particle);
    expect(geoJson.features).toHaveLength(4);
    expect(geoJson.features[1].geometry.coordinates).toHaveLength(1);
  });

  it('scales motion and trail length for the current zoom', () => {
    expect(windParticleSpeedScale(8)).toBe(700);
    expect(windParticleSpeedScale(13)).toBeCloseTo(21.875);
    expect(windParticleSpeedScale(18)).toBe(1);
    expect(windParticleTrailLength(8)).toBe(10);
    expect(windParticleTrailLength(13)).toBe(13);
    expect(windParticleTrailLength(18)).toBe(16);
  });

  it('increases particle density substantially at close zoom', () => {
    expect(windParticleCount(8, 300)).toBe(60);
    expect(windParticleCount(13, 300)).toBeGreaterThan(150);
    expect(windParticleCount(18, 300)).toBe(300);
    expect(windParticleCount(18, 200)).toBe(200);
  });

  it('seeds particles in the visible part of a larger field', () => {
    const bounds = particleBoundsForRegion(field, {
      latitude: 53,
      longitude: 5,
      latitudeDelta: 0.2,
      longitudeDelta: 0.4,
    });

    expect(bounds.west).toBeCloseTo(4.76);
    expect(bounds.south).toBeCloseTo(52.88);
    expect(bounds.east).toBeCloseTo(5.24);
    expect(bounds.north).toBeCloseTo(53.12);
  });

  it('uses four style-aware speed buckets and high-contrast colors', () => {
    expect([0, 7.99, 8, 15.99, 16, 24.99, 25].map(windSpeedBucket)).toEqual([
      0, 0, 1, 1, 2, 2, 3,
    ]);
    expect(windBucketColor(0, 'dark', 'speed')).toBe('#e0f2fe');
    expect(windBucketColor(1, 'modern', 'speed')).not.toBe(
      windBucketColor(1, 'satellite', 'speed'),
    );
    expect(windBucketColor(2, 'satellite', 'contrast')).toBe('#ffffff');
  });

  it('builds a transparent-tail to bright-head gradient', () => {
    const gradient = windTrailGradient('#ffffff');

    expect(gradient[4]).toBe('rgba(255, 255, 255, 0)');
    expect(gradient.at(-1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('grows and shrinks trail geometry over 1.2 seconds', () => {
    const trail = Array.from({ length: 16 }, (_, index) => [
      5 + index * 0.001,
      53,
    ]);
    const particle = {
      latitude: 53,
      longitude: 5.015,
      trail,
      age: 1,
      maxAge: 40,
    };

    expect(WIND_PARTICLE_FADE_STEPS).toBe(12);
    expect(particleTrailForLifecycle(particle)).toHaveLength(2);

    particle.age = WIND_PARTICLE_FADE_STEPS;
    expect(particleTrailForLifecycle(particle)).toBe(trail);

    particle.age = particle.maxAge - 6;
    expect(particleTrailForLifecycle(particle)).toHaveLength(8);

    particle.age = particle.maxAge - 1;
    const finalTrail = particleTrailForLifecycle(particle);
    expect(finalTrail).toHaveLength(2);
    expect(finalTrail.at(-1)).toBe(trail.at(-1));
  });

  it('keeps particle and trail objects pooled across resets', () => {
    const particles = createWindParticles(field.bounds, 1, () => 0.5);
    const particle = particles[0];
    const trail = particle.trail;
    particle.maxAge = 0;

    const advanced = advanceWindParticles(
      particles,
      field,
      0.1,
      12,
      field.bounds,
      () => 0.5,
    );

    expect(advanced).toBe(particles);
    expect(advanced[0]).toBe(particle);
    expect(advanced[0].trail).toBe(trail);
  });

  it('packs every trail into four speed-bucket features', () => {
    const particles = createWindParticles(field.bounds, 300, () => 0.5);
    advanceWindParticles(particles, field, 0.1, 12, field.bounds, () => 0.5);

    const geoJson = particlesToGeoJson(particles, field);
    const renderedTrailCount = geoJson.features.reduce(
      (total, feature) => total + feature.geometry.coordinates.length,
      0,
    );

    expect(geoJson.features).toHaveLength(4);
    expect(renderedTrailCount).toBe(300);
  });

  it('only enables particles at a readable zoom', () => {
    expect(shouldRenderWindParticles(7.99)).toBe(false);
    expect(shouldRenderWindParticles(8)).toBe(true);
    expect(shouldRenderWindParticles(Number.NaN)).toBe(false);
  });
});
