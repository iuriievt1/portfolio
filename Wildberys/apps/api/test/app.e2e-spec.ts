import { Body, Controller, Get, Post, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsEmail, IsInt, Min } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { Public } from '../src/auth/public.decorator.js';
import { configureApp } from '../src/configure-app.js';
import { PrismaService } from '../src/database/prisma.service.js';
import type { ApiError } from '../src/errors/api-error.dto.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class ProbeBody {
  @IsEmail()
  readonly email!: string;

  @IsInt()
  @Min(1)
  readonly quantity!: number;
}

/** Routes that exist only in these tests, to exercise validation and unexpected errors. */
@Public()
@Controller('probe')
class ProbeController {
  @Post()
  create(@Body() body: ProbeBody): ProbeBody {
    return body;
  }

  @Get('crash')
  crash(): never {
    throw new Error('a secret detail that must not reach the client');
  }
}

describe('API', () => {
  let app: INestApplication<App>;
  let databaseIsUp: boolean;

  beforeEach(async () => {
    databaseIsUp = true;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: () =>
          databaseIsUp ? Promise.resolve([]) : Promise.reject(new Error('connection refused')),
      })
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers the liveness check without a version prefix', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toMatch(uuidPattern);
  });

  it('lets only the listed web apps call it from a browser', async () => {
    const known = await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:3001');
    const unknown = await request(app.getHttpServer())
      .get('/health')
      .set('origin', 'http://localhost:9999');

    expect(known.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(unknown.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('is ready when the database answers', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('is not ready when the database is down', async () => {
    databaseIsUp = false;

    const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

    expect(response.body).toEqual({
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database does not answer',
      requestId: response.headers['x-request-id'],
    });
  });

  it('puts versioned routes under /v1', async () => {
    await request(app.getHttpServer())
      .post('/v1/probe')
      .send({ email: 'jana@example.cz', quantity: 2 })
      .expect(201);
    await request(app.getHttpServer()).post('/probe').send({}).expect(404);
  });

  it('describes every invalid field', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe')
      .send({ email: 'not-an-email', quantity: 0, extra: true })
      .expect(400);

    const body = response.body as ApiError;

    expect(body).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: 'The request is not valid',
      requestId: response.headers['x-request-id'],
    });
    expect(body.details).toHaveLength(3);
    expect(body.details).toContainEqual({ field: 'email', message: 'email must be an email' });
    expect(body.details).toContainEqual({
      field: 'quantity',
      message: 'quantity must not be less than 1',
    });
    expect(body.details).toContainEqual({
      field: 'extra',
      message: 'property extra should not exist',
    });
  });

  it('answers a broken body in the common error format', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/probe')
      .set('content-type', 'application/json')
      .send('{"email":')
      .expect(400);

    expect(response.headers['x-request-id']).toMatch(uuidPattern);
    expect(response.body).toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      requestId: response.headers['x-request-id'],
    });
  });

  it('answers an unknown route in the common error format', async () => {
    const response = await request(app.getHttpServer()).get('/v1/nothing-here').expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Cannot GET /v1/nothing-here',
      requestId: response.headers['x-request-id'],
    });
  });

  it('hides the details of an unexpected error', async () => {
    const response = await request(app.getHttpServer()).get('/v1/probe/crash').expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong on our side',
      requestId: response.headers['x-request-id'],
    });
  });
});
