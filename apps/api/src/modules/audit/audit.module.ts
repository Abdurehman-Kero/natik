import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Activity log writer (FR-REP-003). The viewer is built in M7. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
