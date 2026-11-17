import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis, { type RedisOptions } from 'ioredis';
import { AppConfigService } from '../config/app-config.service';

export const REDIS = Symbol('REDIS');

/** Turns `redis://:password@host:port/db` into ioredis/BullMQ connection options. */
export function redisOptionsFromUrl(url: string): RedisOptions {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const logger = new Logger('Redis');
        const client = new Redis({
          ...redisOptionsFromUrl(config.get('REDIS_URL')),
          maxRetriesPerRequest: 2,
          // Fail fast instead of queueing commands forever while Redis is down.
          enableOfflineQueue: false,
        });
        client.on('error', (err) => logger.warn(`Redis connection problem: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
