import { HttpException, HttpStatus } from '@nestjs/common';
import { type ApiErrorBody, ErrorCode } from '@natik/shared';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';
import { AppException } from './app.exception';
import { DEFAULT_ERROR_MESSAGES } from './error-messages';

const STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.BAD_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.METHOD_NOT_ALLOWED]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

export interface ErrorResponse {
  status: number;
  body: ApiErrorBody;
}

/** Field path → messages, e.g. `{ "email": ["Enter a valid email"] }`. */
export function zodFieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || '_';
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

/**
 * Maps any thrown value to the standard `{ error: { code, message, … } }` shape.
 * Unknown errors become a generic 500 and never leak internal details.
 */
export function toErrorResponse(exception: unknown): ErrorResponse {
  if (exception instanceof ZodValidationException) {
    const zodError = exception.getZodError();
    return {
      status: HttpStatus.BAD_REQUEST,
      body: {
        error: {
          code: ErrorCode.VALIDATION_FAILED,
          message: DEFAULT_ERROR_MESSAGES.VALIDATION_FAILED,
          fields: zodError instanceof ZodError ? zodFieldErrors(zodError) : undefined,
        },
      },
    };
  }

  if (exception instanceof AppException) {
    return {
      status: exception.getStatus(),
      body: {
        error: {
          code: exception.code,
          message: exception.message,
          params: exception.params,
          fields: exception.fields,
        },
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code =
      STATUS_TO_CODE[status] ?? (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST);
    return {
      status,
      body: { error: { code, message: DEFAULT_ERROR_MESSAGES[code] } },
    };
  }

  // Errors from Express middleware (e.g. malformed JSON body) carry a 4xx `status`.
  const maybeStatus = (exception as { status?: unknown } | null)?.status;
  if (typeof maybeStatus === 'number' && maybeStatus >= 400 && maybeStatus < 500) {
    const code = STATUS_TO_CODE[maybeStatus] ?? ErrorCode.BAD_REQUEST;
    return {
      status: maybeStatus,
      body: { error: { code, message: DEFAULT_ERROR_MESSAGES[code] } },
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      error: { code: ErrorCode.INTERNAL_ERROR, message: DEFAULT_ERROR_MESSAGES.INTERNAL_ERROR },
    },
  };
}
