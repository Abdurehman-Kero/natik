import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Request, Response } from 'express';
import { toErrorResponse } from './to-error-response';

/** Every error leaves the API in one shape: `{ error: { code, message, requestId, … } }`. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') throw exception;

    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const { status, body } = toErrorResponse(exception);
    body.error.requestId = typeof req.id === 'string' ? req.id : undefined;

    if (status >= 500) {
      this.logger.error(
        { err: exception, requestId: body.error.requestId },
        'Unhandled error while processing request',
      );
      Sentry.captureException(exception);
    }

    if (!res.headersSent) res.status(status).json(body);
  }
}
