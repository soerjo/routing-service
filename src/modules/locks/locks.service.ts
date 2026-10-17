import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module.js';
import type { AcquireLockDto } from './dto/acquire-lock.dto.js';
import type { ReleaseLockDto } from './dto/release-lock.dto.js';

export const DEFAULT_LOCK_TTL_MS = 30000;

export const lockKey = (resourceKey: string): string => `lock:${resourceKey}`;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export interface AcquireLockResult {
  acquired: boolean;
  token: string | null;
}

export interface ReleaseLockResult {
  released: boolean;
}

@Injectable()
export class LocksService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async acquire(dto: AcquireLockDto): Promise<AcquireLockResult> {
    const token = randomUUID();
    const ttlMs =
      dto.ttlMs ??
      this.configService.get<number>('LOCK_TTL_MS') ??
      DEFAULT_LOCK_TTL_MS;

    const result = await this.redis.set(
      lockKey(dto.resourceKey),
      token,
      'PX',
      ttlMs,
      'NX',
    );

    if (result !== 'OK') {
      return { acquired: false, token: null };
    }
    return { acquired: true, token };
  }

  async release(dto: ReleaseLockDto): Promise<ReleaseLockResult> {
    const removed = await this.redis.eval(
      RELEASE_SCRIPT,
      1,
      lockKey(dto.resourceKey),
      dto.token,
    );
    return { released: removed === 1 };
  }
}
