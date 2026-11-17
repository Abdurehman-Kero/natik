import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { redisOptionsFromUrl } from '../redis/redis.module';
import { QUEUE_NAMES } from './queues';

/**
 * Connects BullMQ and registers every queue, so the API can add jobs and the
 * worker can process them. Imported by both entry points.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        prefix: 'natik',
        connection: {
          ...redisOptionsFromUrl(config.get('REDIS_URL')),
          // Required by BullMQ workers: blocking commands must retry forever.
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      }),
    }),
    BullModule.registerQueue(...QUEUE_NAMES.map((name) => ({ name }))),
  ],
  exports: [BullModule],
})
export class QueueModule {}
