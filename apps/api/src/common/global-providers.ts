import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { AllExceptionsFilter } from './errors/all-exceptions.filter';

/** Global request handling used by the app and by tests: zod validation + one error shape. */
export const GLOBAL_PROVIDERS = [
  { provide: APP_PIPE, useClass: ZodValidationPipe },
  { provide: APP_FILTER, useClass: AllExceptionsFilter },
];
