import { Module } from '@nestjs/common';
import { QueueModule } from '../../jobs/queue.module';
import { AuditModule } from '../audit/audit.module';
import { AdminUsersController } from './admin-users.controller';
import { RetentionProcessor } from './retention.processor';
import { RetentionService } from './retention.service';
import { MeController } from './users.controller';
import { UsersService } from './users.service';

/** Data-keeping on its own, so the background worker can use it without the rest of the users module. */
@Module({
  imports: [AuditModule],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}

/** Profiles and admin user management (FR-AUTH, FR-ADMIN-002, BR-ROLE-004). */
@Module({
  imports: [RetentionModule],
  controllers: [MeController, AdminUsersController],
  providers: [UsersService],
  exports: [UsersService, RetentionModule],
})
export class UsersModule {}

/** The daily clean-up job. Imported by the worker side only (see ProcessorsModule). */
@Module({
  imports: [QueueModule, RetentionModule],
  providers: [RetentionProcessor],
})
export class UsersWorkerModule {}
