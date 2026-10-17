import { Logger } from '@nestjs/common';
import { DriverStatus } from '@prisma/client';
import type { Redis } from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DriverLocationService } from './driver-location.service.js';

interface RedisMock {
  geoadd: jest.Mock;
  set: jest.Mock;
  zrem: jest.Mock;
}

interface PrismaMock {
  driverProfile: { upsert: jest.Mock };
}

const buildService = (redis: RedisMock, prisma: PrismaMock) =>
  new DriverLocationService(
    redis as unknown as Redis,
    prisma as unknown as PrismaService,
  );

describe('DriverLocationService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('updateLocation', () => {
    it('writes GEO + heartbeat and snapshots the location', async () => {
      const redis: RedisMock = {
        geoadd: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        zrem: jest.fn(),
      };
      const prisma: PrismaMock = {
        driverProfile: { upsert: jest.fn().mockResolvedValue({}) },
      };

      const result = await buildService(redis, prisma).updateLocation(
        'driver-1',
        { lat: -6.2, lng: 106.8 },
      );

      expect(redis.geoadd).toHaveBeenCalledWith(
        'drivers:locations:active',
        106.8,
        -6.2,
        'driver-1',
      );
      expect(redis.set).toHaveBeenCalledWith(
        'driver:heartbeat:driver-1',
        '1',
        'EX',
        60,
      );
      expect(prisma.driverProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'driver-1' },
          update: { lastKnownLat: -6.2, lastKnownLng: 106.8 },
        }),
      );
      expect(result).toEqual({ driverId: 'driver-1', lat: -6.2, lng: 106.8 });
    });

    it('does not fail the request when the DB snapshot fails', async () => {
      const redis: RedisMock = {
        geoadd: jest.fn().mockResolvedValue(1),
        set: jest.fn().mockResolvedValue('OK'),
        zrem: jest.fn(),
      };
      const prisma: PrismaMock = {
        driverProfile: {
          upsert: jest.fn().mockRejectedValue(new Error('db down')),
        },
      };

      await expect(
        buildService(redis, prisma).updateLocation('driver-1', {
          lat: -6.2,
          lng: 106.8,
        }),
      ).resolves.toEqual({
        driverId: 'driver-1',
        lat: -6.2,
        lng: 106.8,
      });
    });
  });

  describe('updateStatus', () => {
    it('persists the status and removes OFFLINE drivers from GEO', async () => {
      const redis: RedisMock = {
        geoadd: jest.fn(),
        set: jest.fn(),
        zrem: jest.fn().mockResolvedValue(1),
      };
      const prisma: PrismaMock = {
        driverProfile: { upsert: jest.fn().mockResolvedValue({}) },
      };

      const result = await buildService(redis, prisma).updateStatus(
        'driver-1',
        {
          status: DriverStatus.OFFLINE,
        },
      );

      expect(prisma.driverProfile.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'driver-1' },
          update: { status: DriverStatus.OFFLINE },
        }),
      );
      expect(redis.zrem).toHaveBeenCalledWith(
        'drivers:locations:active',
        'driver-1',
      );
      expect(result).toEqual({
        driverId: 'driver-1',
        status: DriverStatus.OFFLINE,
      });
    });

    it('does not remove ONLINE drivers from GEO', async () => {
      const redis: RedisMock = {
        geoadd: jest.fn(),
        set: jest.fn(),
        zrem: jest.fn(),
      };
      const prisma: PrismaMock = {
        driverProfile: { upsert: jest.fn().mockResolvedValue({}) },
      };

      await buildService(redis, prisma).updateStatus('driver-1', {
        status: DriverStatus.ONLINE,
      });

      expect(redis.zrem).not.toHaveBeenCalled();
    });
  });
});
