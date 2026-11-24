import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PlatformRole } from '../src/generated/prisma/enums.js';
import { newsletterConsentVersion } from '../src/newsletter/newsletter-policy.js';
import type { NewsletterPage } from '../src/newsletter/newsletter.dto.js';
import { bearer, signIn, signInTeamMember } from './support/actors.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const email = 'jana@example.cz';
const rolesWithoutAccess = Object.values(PlatformRole).filter(
  (role) => role !== PlatformRole.OWNER,
);

describe('Newsletter', () => {
  let testApp: TestApp;

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());
  const subscribe = (body: object): request.Test => http().post('/v1/newsletter').send(body);
  const signUps = (): Promise<{ email: string; locale: string; consentVersion: string }[]> =>
    testApp.prisma.newsletterSubscription.findMany({
      orderBy: { id: 'asc' },
      select: { email: true, locale: true, consentVersion: true },
    });

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    testApp.mail.sent.length = 0;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('a sign-up', () => {
    it('is saved with the language of the page and the consent the person gave', async () => {
      const before = Date.now();
      const response = await subscribe({ email, locale: 'en', consent: true }).expect(204);
      const saved = await testApp.prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email },
      });

      expect(response.body).toEqual({});
      expect(saved).toMatchObject({
        email,
        locale: 'en',
        consentVersion: newsletterConsentVersion,
      });
      expect(saved.consentedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(saved.consentedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('needs no account and sends no email', async () => {
      await subscribe({ email, locale: 'cs', consent: true }).expect(204);

      expect(await testApp.prisma.user.count()).toBe(0);
      expect(testApp.mail.sent).toHaveLength(0);
    });

    it('treats the email as case-insensitive', async () => {
      await subscribe({ email: '  Jana@Example.CZ ', locale: 'cs', consent: true }).expect(204);

      expect(await signUps()).toEqual([
        { email, locale: 'cs', consentVersion: newsletterConsentVersion },
      ]);
    });

    it('answers the same way for an email that is already on the list, and keeps the first sign-up', async () => {
      await subscribe({ email, locale: 'cs', consent: true }).expect(204);

      const first = await testApp.prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email },
      });
      const again = await subscribe({ email, locale: 'en', consent: true }).expect(204);

      expect(again.body).toEqual({});
      expect(await testApp.prisma.newsletterSubscription.findMany()).toEqual([first]);
    });

    it.each([
      ['without the consent', { email, locale: 'cs' }],
      ['with the consent refused', { email, locale: 'cs', consent: false }],
      ['with something else in place of the consent', { email, locale: 'cs', consent: 'yes' }],
      ['without a language', { email, consent: true }],
      ['in a language we do not speak', { email, locale: 'de', consent: true }],
      ['with a text that is not an email', { email: 'not-an-email', locale: 'cs', consent: true }],
      ['with a field we do not know', { email, locale: 'cs', consent: true, name: 'Jana' }],
    ])('is refused %s', async (_name, body) => {
      const response = await subscribe(body).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await signUps()).toEqual([]);
    });
  });

  describe('leaving the list', () => {
    const unsubscribe = (body: object): request.Test =>
      http().post('/v1/newsletter/removal').send(body);
    const emails = async (): Promise<string[]> => (await signUps()).map((signUp) => signUp.email);

    it('deletes the sign-up and leaves the others', async () => {
      await subscribe({ email, locale: 'cs', consent: true }).expect(204);
      await subscribe({ email: 'petr@example.cz', locale: 'cs', consent: true }).expect(204);

      const response = await unsubscribe({ email }).expect(204);

      expect(response.body).toEqual({});
      expect(await emails()).toEqual(['petr@example.cz']);
    });

    it('treats the email as case-insensitive', async () => {
      await subscribe({ email, locale: 'cs', consent: true }).expect(204);
      await unsubscribe({ email: '  Jana@Example.CZ ' }).expect(204);

      expect(await emails()).toEqual([]);
    });

    it('answers the same way for an email that is not on the list', async () => {
      const response = await unsubscribe({ email }).expect(204);

      expect(response.body).toEqual({});
    });

    it('lets the person sign up again, with a new consent', async () => {
      await subscribe({ email, locale: 'cs', consent: true }).expect(204);
      const first = await testApp.prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email },
      });

      await unsubscribe({ email }).expect(204);
      await subscribe({ email, locale: 'en', consent: true }).expect(204);
      const second = await testApp.prisma.newsletterSubscription.findUniqueOrThrow({
        where: { email },
      });

      expect(second.id).not.toBe(first.id);
      expect(second.locale).toBe('en');
    });

    it.each([
      ['without an email', {}],
      ['with a text that is not an email', { email: 'not-an-email' }],
      ['with a field we do not know', { email, reason: 'spam' }],
    ])('is refused %s', async (_name, body) => {
      await subscribe({ email, locale: 'cs', consent: true }).expect(204);

      const response = await unsubscribe(body).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await emails()).toEqual([email]);
    });
  });

  describe('the list in the admin', () => {
    const list = (query = ''): request.Test => http().get(`/v1/admin/newsletter${query}`);

    it('needs a signed-in user', async () => {
      const response = await list().expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('is forbidden for a buyer', async () => {
      const buyer = await signIn(testApp, 'buyer@example.cz');

      await list()
        .set(...bearer(buyer))
        .expect(403);
    });

    it.each(rolesWithoutAccess)('is forbidden for the team role %s', async (role) => {
      const member = await signInTeamMember(testApp, 'team@bluberi.cz', [role]);
      const response = await list()
        .set(...bearer(member))
        .expect(403);

      expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('shows the platform owner the sign-ups, newest first', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      await subscribe({ email: 'first@example.cz', locale: 'cs', consent: true }).expect(204);
      await subscribe({ email: 'second@example.cz', locale: 'en', consent: true }).expect(204);

      const response = await list()
        .set(...bearer(owner))
        .expect(200);
      const page = response.body as NewsletterPage;

      expect(page.nextCursor).toBeNull();
      expect(page.items.map(({ email: address, locale }) => ({ address, locale }))).toEqual([
        { address: 'second@example.cz', locale: 'en' },
        { address: 'first@example.cz', locale: 'cs' },
      ]);
      expect(Object.keys(page.items[0] ?? {}).sort()).toEqual([
        'consentedAt',
        'email',
        'id',
        'locale',
      ]);
      expect(Number.isNaN(Date.parse(String(page.items[0]?.consentedAt)))).toBe(false);
    });

    it('is read page by page', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      for (const name of ['one', 'two', 'three']) {
        await subscribe({ email: `${name}@example.cz`, locale: 'cs', consent: true }).expect(204);
      }

      const first = await list('?limit=2')
        .set(...bearer(owner))
        .expect(200);
      const firstPage = first.body as NewsletterPage;

      expect(firstPage.items.map((item) => item.email)).toEqual([
        'three@example.cz',
        'two@example.cz',
      ]);
      expect(firstPage.nextCursor).toBe(firstPage.items[1]?.id);

      const second = await list(`?limit=2&cursor=${String(firstPage.nextCursor)}`)
        .set(...bearer(owner))
        .expect(200);

      expect(second.body).toMatchObject({ items: [{ email: 'one@example.cz' }], nextCursor: null });
    });

    it('rejects a query it does not know', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      await list('?limit=0')
        .set(...bearer(owner))
        .expect(400);
      await list('?email=jana')
        .set(...bearer(owner))
        .expect(400);
    });
  });
});
