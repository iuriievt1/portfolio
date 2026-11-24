import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthTokens } from '../src/auth/auth.dto.js';
import { configureApp } from '../src/configure-app.js';
import type { UploadedImage } from '../src/images/images.dto.js';
import { MailSender } from '../src/mail/mail-sender.js';
import { FileStorage } from '../src/storage/file-storage.js';
import { bearer, signIn } from './support/actors.js';
import {
  createTestApp,
  RecordingMailSender,
  resetDatabase,
  type TestApp,
} from './support/test-app.js';

const storagePublicUrl = 'http://localhost:9100/bluberi-test';
const megabyte = 1024 * 1024;

function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 108, g: 76, b: 255 } } })
    .jpeg()
    .toBuffer();
}

class BrokenFileStorage extends FileStorage {
  put(): Promise<void> {
    return Promise.reject(new Error('the storage is down'));
  }

  publicUrl(key: string): string {
    return key;
  }
}

describe('Photo upload', () => {
  let testApp: TestApp;
  let tokens: AuthTokens;

  const upload = (app: INestApplication<App>, file: Buffer, name = 'photo.jpg'): request.Test =>
    request(app.getHttpServer())
      .post('/v1/images')
      .set(...bearer(tokens))
      .attach('file', file, name);

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    tokens = await signIn(testApp, 'jana@example.cz');
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('stores WebP copies in several sizes that anyone can open by their address', async () => {
    const response = await upload(testApp.app, await jpeg(1600, 1200)).expect(201);
    const image = response.body as UploadedImage;

    expect(image).toMatchObject({ width: 1600, height: 1200 });
    expect(image.copies).toEqual([
      { width: 320, height: 240, url: `${storagePublicUrl}/images/${image.id}/320.webp` },
      { width: 640, height: 480, url: `${storagePublicUrl}/images/${image.id}/640.webp` },
      { width: 1280, height: 960, url: `${storagePublicUrl}/images/${image.id}/1280.webp` },
      { width: 1600, height: 1200, url: `${storagePublicUrl}/images/${image.id}/1600.webp` },
    ]);

    for (const copy of image.copies) {
      const file = await fetch(copy.url);
      const metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();

      expect(file.status).toBe(200);
      expect(file.headers.get('content-type')).toBe('image/webp');
      expect(file.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
      expect(metadata).toMatchObject({ format: 'webp', width: copy.width, height: copy.height });
    }
  });

  it('remembers the photo and who uploaded it', async () => {
    const response = await upload(testApp.app, await jpeg(500, 300)).expect(201);
    const image = response.body as UploadedImage;
    const stored = await testApp.prisma.image.findUniqueOrThrow({
      where: { id: image.id },
      include: { uploadedBy: true },
    });

    expect(stored).toMatchObject({
      width: 500,
      height: 300,
      copyWidths: [320, 500],
      uploadedBy: { email: 'jana@example.cz' },
    });
  });

  it('does not let anyone list the files of the bucket', async () => {
    await upload(testApp.app, await jpeg(400, 300)).expect(201);

    expect((await fetch(`${storagePublicUrl}/`)).status).toBe(403);
  });

  it('accepts a photo whatever its file name says', async () => {
    await upload(testApp.app, await jpeg(400, 300), 'holiday').expect(201);
  });

  it('refuses a file that is not a photo, whatever its file name says', async () => {
    const response = await upload(testApp.app, Buffer.from('<html>hello</html>'), 'photo.jpg');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'IMAGE_INVALID' });
    expect(await testApp.prisma.image.count()).toBe(0);
  });

  it('refuses a request without a file', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/v1/images')
      .set(...bearer(tokens))
      .field('title', 'no file here')
      .expect(400);

    expect(response.body).toMatchObject({ code: 'IMAGE_REQUIRED' });
  });

  it('refuses a file over 10 MB', async () => {
    const response = await upload(testApp.app, Buffer.alloc(10 * megabyte + 1));

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(await testApp.prisma.image.count()).toBe(0);
  });

  it('needs a signed-in user', async () => {
    const response = await request(testApp.app.getHttpServer())
      .post('/v1/images')
      .attach('file', await jpeg(400, 300), 'photo.jpg')
      .expect(401);

    expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('remembers nothing when the storage fails', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailSender)
      .useValue(new RecordingMailSender())
      .overrideProvider(FileStorage)
      .useValue(new BrokenFileStorage())
      .compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });

    configureApp(app);
    await app.init();

    try {
      const response = await upload(app, await jpeg(400, 300)).expect(500);

      expect(response.body).toMatchObject({ code: 'INTERNAL_SERVER_ERROR' });
      expect(await testApp.prisma.image.count()).toBe(0);
    } finally {
      await app.close();
    }
  });
});
