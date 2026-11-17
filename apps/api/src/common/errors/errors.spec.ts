import {
  Body,
  Controller,
  Get,
  HttpStatus,
  type INestApplication,
  Logger,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createZodDto } from 'nestjs-zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GLOBAL_PROVIDERS } from '../global-providers';
import { AppException } from './app.exception';

class CreateThingDto extends createZodDto(
  z.object({ name: z.string().min(2), age: z.number().int() }),
) {}

@Controller('things')
class ThingsController {
  @Post()
  create(@Body() dto: CreateThingDto) {
    return dto;
  }

  @Get('duplicate')
  duplicate() {
    throw new AppException('PAYMENT_REFERENCE_DUPLICATE', HttpStatus.CONFLICT);
  }

  @Get('too-big')
  tooBig() {
    throw new AppException('FILE_TOO_LARGE', HttpStatus.PAYLOAD_TOO_LARGE, {
      message: 'This file is 32 MB. The maximum is 25 MB.',
      params: { size: 32, max: 25 },
    });
  }

  @Get('boom')
  boom() {
    throw new Error('database password is hunter2');
  }
}

describe('standard error shape (ARCHITECTURE §7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThingsController],
      providers: [...GLOBAL_PROVIDERS],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    Logger.overrideLogger(false);
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('unknown routes return NOT_FOUND without technical details', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/does-not-exist').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: "We couldn't find that." },
    });
  });

  it('invalid input returns VALIDATION_FAILED with per-field messages', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/things')
      .send({ name: 'a' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.error.fields)).toEqual(expect.arrayContaining(['name', 'age']));
  });

  it('valid input passes through the zod pipe', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/things')
      .send({ name: 'Abdi', age: 20 })
      .expect(201);
    expect(res.body).toEqual({ name: 'Abdi', age: 20 });
  });

  it('business errors use the SRS §10 wording', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/duplicate').expect(409);
    expect(res.body.error).toMatchObject({
      code: 'PAYMENT_REFERENCE_DUPLICATE',
      message: 'This reference was already submitted. Contact us if this is a mistake.',
    });
  });

  it('carries message parameters for the web app', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/too-big').expect(413);
    expect(res.body.error).toMatchObject({ code: 'FILE_TOO_LARGE', params: { size: 32, max: 25 } });
  });

  it('unexpected errors return a generic 500 and never leak internals', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/things/boom').expect(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('malformed JSON returns BAD_REQUEST', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/things')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
