import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';
import { REDIS } from '../../redis/redis.module';
import { AppException } from '../errors/app.exception';

/** Fixed-window counters in Redis, shared by every API instance (NFR-SEC-005). */
@Injectable()
export class RateLimiter {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly config: AppConfigService,
  ) {}

  /** Counts one hit; returns false once `limit` is exceeded inside the window. */
  async hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const redisKey = `rl:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, windowSeconds);
    return count <= limit * this.config.get('RATE_LIMIT_MULTIPLIER');
  }

  /** Counts one event and returns how many happened inside the current window. */
  async count(key: string, windowSeconds: number): Promise<number> {
    const redisKey = `rl:${key}`;
    const count = await this.redis.incr(redisKey);
    if (count === 1) await this.redis.expire(redisKey, windowSeconds);
    return count;
  }

  /** Same, but throws the standard 429 error. */
  async assert(key: string, limit: number, windowSeconds: number): Promise<void> {
    if (!(await this.hit(key, limit, windowSeconds))) {
      throw new AppException('RATE_LIMITED', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(`rl:${key}`);
  }
}
