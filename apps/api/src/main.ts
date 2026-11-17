import './load-env';
import './instrument';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const config = app.get(AppConfigService);

  // Behind the reverse proxy / Cloudflare: trust the first hop for client IPs.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // The API only serves JSON; Swagger UI (non-production) needs its own inline assets.
      contentSecurityPolicy: config.isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  if (!config.isProduction) setupSwagger(app);

  const port = config.get('API_PORT');
  await app.listen(port);
  logger.log(
    `API ready on http://localhost:${port}/api/v1` +
      (config.isProduction ? '' : `  ·  docs: http://localhost:${port}/api/docs`),
    'Bootstrap',
  );
}

void bootstrap();
