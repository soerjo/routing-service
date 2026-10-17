import { ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { LocksService, lockKey } from './locks.service.js';

type SetMock = jest.Mock<Promise<'OK' | null>, unknown[]>;

const setMock = (result: 'OK' | null): SetMock =>
  (jest.fn() as SetMock).mockResolvedValue(result);

const buildConfigService = (values: Record<string, unknown>) =>
  ({
    get: jest.fn((key: string) => values[key]),
  }) as unknown as ConfigService;

describe('LocksService', () => {
  describe('acquire', () => {
    it('stores the token with SET NX PX and returns it when acquired', async () => {
      const set = setMock('OK');
      const redis = { set } as unknown as Redis;
      const service = new LocksService(
        redis,
        buildConfigService({ LOCK_TTL_MS: 45000 }),
      );

      const result = await service.acquire({ resourceKey: 'booking:1' });

      expect(result.acquired).toBe(true);
      expect(typeof result.token).toBe('string');
      expect(set.mock.calls[0]).toEqual([
        lockKey('booking:1'),
        result.token,
        'PX',
        45000,
        'NX',
      ]);
    });

    it('honours an explicit ttlMs over the configured default', async () => {
      const set = setMock('OK');
      const redis = { set } as unknown as Redis;
      const service = new LocksService(
        redis,
        buildConfigService({ LOCK_TTL_MS: 45000 }),
      );

      await service.acquire({ resourceKey: 'booking:1', ttlMs: 1000 });

      expect(set.mock.calls[0][3]).toBe(1000);
    });

    it('returns acquired=false with no token when the lock is held', async () => {
      const redis = { set: setMock(null) } as unknown as Redis;
      const service = new LocksService(redis, buildConfigService({}));

      const result = await service.acquire({ resourceKey: 'booking:1' });

      expect(result).toEqual({ acquired: false, token: null });
    });
  });

  describe('release', () => {
    it('reports released=true when the Lua script deletes the key', async () => {
      const evalMock = jest.fn().mockResolvedValue(1);
      const redis = { eval: evalMock } as unknown as Redis;
      const service = new LocksService(redis, buildConfigService({}));

      const result = await service.release({
        resourceKey: 'booking:1',
        token: 'tok',
      });

      expect(result).toEqual({ released: true });
      expect(evalMock.mock.calls[0]).toEqual([
        expect.any(String),
        1,
        lockKey('booking:1'),
        'tok',
      ]);
    });

    it('reports released=false when the token no longer matches', async () => {
      const redis = {
        eval: jest.fn().mockResolvedValue(0),
      } as unknown as Redis;
      const service = new LocksService(redis, buildConfigService({}));

      expect(
        await service.release({ resourceKey: 'booking:1', token: 'stale' }),
      ).toEqual({ released: false });
    });
  });
});
