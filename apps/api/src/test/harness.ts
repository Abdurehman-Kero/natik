import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type Redis from 'ioredis';
import request from 'supertest';
import { AppModule } from '../app.module';
import { hashPassword } from '../common/security/password-hasher';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS } from '../redis/redis.module';

export interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  redis: Redis;
  /** Clears rate-limit counters so tests don't affect each other. */
  resetLimits(): Promise<void>;
  /** The newest SMS code sent to a phone. */
  lastCode(phone: string): Promise<string>;
  /** Creates a user directly in the database. */
  makeUser(options: {
    role?: 'STUDENT' | 'TEACHER' | 'ADMIN';
    isOwner?: boolean;
    password?: string;
    verified?: boolean;
    phone?: string;
  }): Promise<{ id: string; phone: string; password: string }>;
  /** A browser-like client that keeps its cookies. */
  client(): ReturnType<typeof request.agent>;
  signIn(phone: string, password: string): Promise<ReturnType<typeof request.agent>>;
  close(): Promise<void>;
}

export const randomPhone = (): string =>
  `+2519${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

export async function createHarness(): Promise<Harness> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  await app.init();

  const prisma = app.get(PrismaService);
  const redis = app.get<Redis>(REDIS);
  await prisma.branch.upsert({
    where: { name: 'Main Centre' },
    update: {},
    create: { name: 'Main Centre' },
  });
  const branch = await prisma.branch.findFirstOrThrow();

  const harness: Harness = {
    app,
    prisma,
    redis,
    async resetLimits() {
      const keys = await redis.keys('rl:*');
      if (keys.length > 0) await redis.del(...keys);
    },
    async lastCode(phone) {
      const message = await prisma.smsMessage.findFirstOrThrow({
        where: { to: phone },
        orderBy: { createdAt: 'desc' },
      });
      const match = /(\d{6})/.exec(message.body);
      if (!match) throw new Error(`No code in SMS: ${message.body}`);
      return match[1]!;
    },
    async makeUser({
      role = 'STUDENT',
      isOwner = false,
      password = 'Passw0rd123',
      verified = true,
      phone,
    }) {
      const number = phone ?? randomPhone();
      const user = await prisma.user.create({
        data: {
          branchId: branch.id,
          fullName: `Test ${role}`,
          phone: number,
          passwordHash: await hashPassword(password),
          role,
          isOwner,
          phoneVerifiedAt: verified ? new Date() : null,
        },
      });
      return { id: user.id, phone: number, password };
    },
    client: () => request.agent(app.getHttpServer()),
    async signIn(phone, password) {
      const agent = harness.client();
      await agent.post('/api/v1/auth/sign-in').send({ phone, password }).expect(200);
      return agent;
    },
    close: () => app.close(),
  };
  await harness.resetLimits();
  return harness;
}
