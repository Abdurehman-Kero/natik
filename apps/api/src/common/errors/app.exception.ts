import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@natik/shared';
import { DEFAULT_ERROR_MESSAGES } from './error-messages';

interface AppExceptionOptions {
  message?: string;
  params?: Record<string, string | number>;
  fields?: Record<string, string[]>;
  cause?: unknown;
}

/**
 * The one exception type for expected business errors.
 * Example: `throw new AppException('PAYMENT_REFERENCE_DUPLICATE', HttpStatus.CONFLICT)`.
 */
export class AppException extends HttpException {
  readonly code: ErrorCode;
  readonly params?: Record<string, string | number>;
  readonly fields?: Record<string, string[]>;

  constructor(code: ErrorCode, status: HttpStatus, options: AppExceptionOptions = {}) {
    const message = options.message ?? DEFAULT_ERROR_MESSAGES[code];
    super(message, status, { cause: options.cause });
    this.code = code;
    this.params = options.params;
    this.fields = options.fields;
  }
}
