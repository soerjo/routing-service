import { Inject, Injectable, Logger } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import {
  DRIVERS_GEO_KEY,
  driverHeartbeatKey,
} from '../routing/routing.service.js';
import type { UpdateLocationDto } from './dto/update-location.dto.js';
import type { UpdateStatusDto } from './dto/update-status.dto.js';

export const HEARTBEAT_TTL_SECONDS = 60;
const PLACEHOLDER_VEHICLE_TYPE = 'UNKNOWN';
const PLACEHOLDER_VEHICLE_PLATE = 'UNKNOWN';

@Injectable()
export class DriverLocationService {
  private readonly logger = new Logger(DriverLocationService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  async updateLocation(driverId: string, dto: UpdateLocationDto) {
    await this.redis.geoadd(DRIVERS_GEO_KEY, dto.lng, dto.lat, driverId);
    await this.redis.set(
      driverHeartbeatKey(driverId),
      '1',
      'EX',
      HEARTBEAT_TTL_SECONDS,
    );

    await this.persistSnapshot(driverId, dto.lat, dto.lng);

    return { driverId, lat: dto.lat, lng: dto.lng };
  }

  async updateStatus(driverId: string, dto: UpdateStatusDto) {
    await this.prisma.driverProfile.upsert({
      where: { userId: driverId },
      update: { status: dto.status },
      create: {
        userId: driverId,
        vehicleType: PLACEHOLDER_VEHICLE_TYPE,
        vehiclePlateNumber: PLACEHOLDER_VEHICLE_PLATE,
        status: dto.status,
      },
    });

    if (dto.status === DriverStatus.OFFLINE) {
      await this.redis.zrem(DRIVERS_GEO_KEY, driverId);
    }

    return { driverId, status: dto.status };
  }

  /**
   * Best-effort snapshot mirror. The source of truth for live location is
   * Redis GEO, so a database failure must not fail the request.
   */
  private async persistSnapshot(
    driverId: string,
    lat: number,
    lng: number,
  ): Promise<void> {
    try {
      await this.prisma.driverProfile.upsert({
        where: { userId: driverId },
        update: { lastKnownLat: lat, lastKnownLng: lng },
        create: {
          userId: driverId,
          vehicleType: PLACEHOLDER_VEHICLE_TYPE,
          vehiclePlateNumber: PLACEHOLDER_VEHICLE_PLATE,
          lastKnownLat: lat,
          lastKnownLng: lng,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to persist location snapshot for driver ${driverId}: ${String(error)}`,
      );
    }
  }
}
