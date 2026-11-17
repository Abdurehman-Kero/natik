import './load-env';
import './instrument';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { WorkerModule } from './worker.module';

/** Background worker entry: `node dist/worker.js` (staging/production). */
async function bootstrap(): Promise<void> {
  // Labels log lines so API and worker output can be told apart.
  process.env.NATIK_PROCESS = 'worker';
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.init();
}

void bootstrap();
