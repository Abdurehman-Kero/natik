import { Module } from '@nestjs/common';
import { AccessModule } from './common/access/access.module';
import { AppLoggerModule } from './common/logging/logger.module';
import { AppConfigModule } from './config/config.module';
import { StorageModule } from './common/storage/storage.module';
import { QueueModule } from './jobs/queue.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';

/** Infrastructure shared by the API and the worker. */
@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    AccessModule,
  ],
  exports: [
    AppConfigModule,
    AppLoggerModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    AccessModule,
  ],
})
export class CoreModule {}
