import { Module, type Type } from '@nestjs/common';
import { GLOBAL_PROVIDERS } from './common/global-providers';
import { CoreModule } from './core.module';
import { HealthModule } from './health/health.module';
import { ProcessorsModule } from './jobs/processors.module';
import { FEATURE_MODULES } from './modules';

// Local development runs queue processors inside the API (one process to start).
// Staging/production run them in the separate worker process (src/worker.ts).
const inProcessWorker: Type[] = process.env.RUN_WORKER_IN_API === 'true' ? [ProcessorsModule] : [];

@Module({
  imports: [CoreModule, HealthModule, ...FEATURE_MODULES, ...inProcessWorker],
  providers: [...GLOBAL_PROVIDERS],
})
export class AppModule {}
