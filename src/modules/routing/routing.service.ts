import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import { OsrmClient } from './osrm.client.js';
import { haversineDistanceMeters } from './haversine.util.js';
import type { NearbyDriversQueryDto } from './dto/nearby-drivers-query.dto.js';
import type { RouteQueryDto } from './dto/route-query.dto.js';
import type {
  Coordinates,
  NearbyDriver,
  RouteResult,
} from './routing.types.js';

export const DRIVERS_GEO_KEY = 'drivers:locations:active';
export const driverHeartbeatKey = (driverId: string): string =>
  `driver:heartbeat:${driverId}`;

// Straight-line distance underestimates real road distance; the detour
// factor approximates it when OSRM is unavailable.
export const HAVERSINE_DETOUR_FACTOR = 1.35;
export const DEFAULT_HAVERSINE_SPEED_KMH = 30;

@Injectable()
export class RoutingService {
  constructor(
    private readonly osrmClient: OsrmClient,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getRoute(dto: RouteQueryDto): Promise<RouteResult> {
    const origin: Coordinates = { lat: dto.originLat, lng: dto.originLng };
    const destination: Coordinates = { lat: dto.destLat, lng: dto.destLng };

    const osrmRoute = await this.osrmClient.getRoute(origin, destination);
    if (osrmRoute) {
      return osrmRoute;
    }

    return this.haversineFallback(origin, destination);
  }

  private haversineFallback(
    origin: Coordinates,
    destination: Coordinates,
  ): RouteResult {
    const straightLineMeters = haversineDistanceMeters(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
    );
    const distanceMeters = straightLineMeters * HAVERSINE_DETOUR_FACTOR;

    const speedKmh =
      this.configService.get<number>('HAVERSINE_SPEED_KMH') ??
      DEFAULT_HAVERSINE_SPEED_KMH;
    const durationSeconds = (distanceMeters / 1000 / speedKmh) * 3600;

    return {
      distanceMeters: Math.round(distanceMeters),
      durationSeconds: Math.round(durationSeconds),
      polyline: '',
      routeSource: 'HAVERSINE_FALLBACK',
    };
  }

  async findNearbyDrivers(dto: NearbyDriversQueryDto): Promise<NearbyDriver[]> {
    const raw = (await this.redis.georadius(
      DRIVERS_GEO_KEY,
      dto.lng,
      dto.lat,
      dto.radiusKm,
      'km',
      'WITHDIST',
      'ASC',
      'COUNT',
      dto.limit,
    )) as unknown;

    if (!Array.isArray(raw)) {
      return [];
    }

    const candidates = raw as Array<[string, string]>;
    const drivers: NearbyDriver[] = [];

    for (const entry of candidates) {
      const [driverId, distanceKm] = entry;
      const alive = await this.redis.exists(driverHeartbeatKey(driverId));
      if (!alive) {
        continue;
      }
      drivers.push({
        driverId: String(driverId),
        distanceMeters: Math.round(Number(distanceKm) * 1000),
      });
    }

    return drivers;
  }
}
