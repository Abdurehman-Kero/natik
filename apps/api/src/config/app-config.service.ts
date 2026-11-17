import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env';

/** Typed access to validated configuration: `config.get('API_PORT')` is a number. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('APP_ENV') === 'production';
  }

  get isLocal(): boolean {
    return this.get('APP_ENV') === 'local';
  }
}
