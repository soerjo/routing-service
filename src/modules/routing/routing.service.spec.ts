import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { OsrmClient } from './osrm.client.js';
import { RoutingService } from './routing.service.js';
import { haversineDistanceMeters } from './haversine.util.js';

const buildConfigService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

describe('RoutingService', () => {
  describe('getRoute', () => {
    it('returns the OSRM route when the client succeeds', async () => {
      const osrmClient = {
        getRoute: jest.fn().mockResolvedValue({
          distanceMeters: 4321,
          durationSeconds: 300,
          polyline: 'poly',
          routeSource: 'OSRM',
        }),
      } as unknown as OsrmClient;

      const service = new RoutingService(
        osrmClient,
        buildConfigService({ HAVERSINE_SPEED_KMH: 30 }),
        {} as Redis,
      );

      const result = await service.getRoute({
        originLat: -6.2,
        originLng: 106.8,
        destLat: -6.9,
        destLng: 107.6,
      });

      expect(result).toEqual({
        distanceMeters: 4321,
        durationSeconds: 300,
        polyline: 'poly',
        routeSource: 'OSRM',
      });
    });

    it('falls back to haversine when OSRM returns null', async () => {
      const osrmClient = {
        getRoute: jest.fn().mockResolvedValue(null),
      } as unknown as OsrmClient;

      const service = new RoutingService(
        osrmClient,
        buildConfigService({ HAVERSINE_SPEED_KMH: 30 }),
        {} as Redis,
      );

      const origin = { lat: -6.2, lng: 106.8 };
      const destination = { lat: -6.9, lng: 107.6 };
      const result = await service.getRoute({
        originLat: origin.lat,
        originLng: origin.lng,
        destLat: destination.lat,
        destLng: destination.lng,
      });

      const straightLine = haversineDistanceMeters(
        origin.lat,
        origin.lng,
        destination.lat,
        destination.lng,
      );
      const expectedDistance = Math.round(straightLine * 1.35);
      const expectedDuration = Math.round(
        (expectedDistance / 1000 / 30) * 3600,
      );

      expect(result.routeSource).toBe('HAVERSINE_FALLBACK');
      expect(result.polyline).toBe('');
      expect(result.distanceMeters).toBe(expectedDistance);
      expect(result.durationSeconds).toBe(expectedDuration);
    });
  });

  describe('findNearbyDrivers', () => {
    it('filters out drivers without a live heartbeat', async () => {
      const redis = {
        georadius: jest.fn().mockResolvedValue([
          ['driver-1', '0.5'],
          ['driver-2', '2.0'],
        ]),
        exists: jest.fn((key: string) =>
          Promise.resolve(key === 'driver:heartbeat:driver-1' ? 1 : 0),
        ),
      } as unknown as Redis;

      const service = new RoutingService(
        {} as OsrmClient,
        buildConfigService({}),
        redis,
      );

      const result = await service.findNearbyDrivers({
        lat: -6.2,
        lng: 106.8,
        radiusKm: 5,
        limit: 10,
      });

      expect(result).toEqual([{ driverId: 'driver-1', distanceMeters: 500 }]);
      expect((redis.georadius as jest.Mock).mock.calls[0]).toEqual([
        'drivers:locations:active',
        106.8,
        -6.2,
        5,
        'km',
        'WITHDIST',
        'ASC',
        'COUNT',
        10,
      ]);
    });

    it('returns an empty array when Redis returns a non-array', async () => {
      const redis = {
        georadius: jest.fn().mockResolvedValue(null),
        exists: jest.fn(),
      } as unknown as Redis;

      const service = new RoutingService(
        {} as OsrmClient,
        buildConfigService({}),
        redis,
      );

      expect(
        await service.findNearbyDrivers({
          lat: -6.2,
          lng: 106.8,
          radiusKm: 5,
          limit: 10,
        }),
      ).toEqual([]);
    });
  });
});
