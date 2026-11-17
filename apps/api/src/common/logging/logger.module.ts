import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module, RequestMethod } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from '../../config/app-config.service';

/**
 * Fields that must never reach the logs (phones, secrets, codes).
 * Request headers and bodies are not logged at all; these paths are a second line of defence.
 */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.passwordHash',
  '*.phone',
  '*.code',
  '*.otp',
  '*.token',
  '*.tokenHash',
];

const MAX_REQUEST_ID_LENGTH = 128;

function requestId(req: IncomingMessage, res: ServerResponse): string {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && incoming.length > 0 && incoming.length <= MAX_REQUEST_ID_LENGTH
      ? incoming
      : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        // Express 5 route syntax for "every path" (the default "*" is deprecated).
        forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
        pinoHttp: {
          level: config.get('LOG_LEVEL'),
          genReqId: requestId,
          redact: { paths: REDACT_PATHS, censor: '[redacted]' },
          base: { service: process.env.NATIK_PROCESS ?? 'api', env: config.get('APP_ENV') },
          // Keep request logs lean: no headers, no query strings with personal data.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              path: req.url?.split('?')[0],
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: {
            ignore: (req: IncomingMessage) => req.url === '/api/v1/health',
          },
          transport:
            config.get('NODE_ENV') === 'development'
              ? {
                  target: 'pino-pretty',
                  options: {
                    singleLine: true,
                    translateTime: 'SYS:HH:MM:ss',
                    ignore: 'pid,hostname,env',
                  },
                }
              : undefined,
        },
      }),
    }),
  ],
})
export class AppLoggerModule {}
