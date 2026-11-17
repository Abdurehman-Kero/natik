import { once } from 'node:events';
import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import Redis from 'ioredis';
import { Public } from '../modules/auth/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

const CHECK_TIMEOUT_MS = 2000;

type CheckState = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  checks: { database: CheckState; redis: CheckState };
  version: string;
  time: string;
}

async function probe(check: () => Promise<unknown>): Promise<CheckState> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([check(), timeout]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

@ApiTags('Health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Liveness and dependency check (database, Redis)' })
  @ApiOkResponse({ description: 'All dependencies are reachable' })
  @ApiServiceUnavailableResponse({ description: 'At least one dependency is down' })
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      probe(async () => {
        // Right after start-up the client may still be connecting; wait (bounded) instead of failing.
        if (this.redis.status !== 'ready') {
          await once(this.redis, 'ready', { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) });
        }
        return this.redis.ping();
      }),
    ]);
    const ok = database === 'up' && redis === 'up';
    if (!ok) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    res.setHeader('Cache-Control', 'no-store');
    return {
      status: ok ? 'ok' : 'degraded',
      checks: { database, redis },
      version: process.env.npm_package_version ?? '0.0.0',
      time: new Date().toISOString(),
    };
  }
}
