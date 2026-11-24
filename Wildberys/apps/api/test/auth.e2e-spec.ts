import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type {
  AuthTokens,
  CurrentUser,
  SignInConfirmation,
  SignInStarted,
} from '../src/auth/auth.dto.js';
import { SignInMethod, UserStatus } from '../src/generated/prisma/enums.js';
import {
  bearer,
  lastCode,
  makeCodesOld,
  requestEmailCode,
  signIn,
  signInWithPassword,
} from './support/actors.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const email = 'jana@example.cz';
const password = 'correct horse battery';
const phone = '+420777123456';
const longAgo = new Date(Date.now() - 60 * 60 * 1000);

describe('Sign-in', () => {
  let testApp: TestApp;

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());
  const meWithToken = (accessToken: string): request.Test =>
    http().get('/v1/auth/me').set('authorization', `Bearer ${accessToken}`);
  const me = (tokens: AuthTokens): request.Test => meWithToken(tokens.accessToken);

  async function setPassword(tokens: AuthTokens, newPassword: string): Promise<void> {
    await http()
      .put('/v1/auth/password')
      .set(...bearer(tokens))
      .send({ newPassword })
      .expect(204);
  }

  /** The first step of a sign-in with a password. */
  async function passwordStep(): Promise<SignInConfirmation> {
    const response = await http()
      .post('/v1/auth/sign-in/password')
      .send({ email, password, app: 'seller' })
      .expect(200);

    return response.body as SignInConfirmation;
  }

  const confirmation = (confirmationToken: string, code: string): request.Test =>
    http().post('/v1/auth/sign-in/confirmation').send({ confirmationToken, code });

  async function requestPhoneCode(tokens: AuthTokens): Promise<string> {
    await http()
      .post('/v1/auth/phone-code')
      .set(...bearer(tokens))
      .send({ phone })
      .expect(200);

    return lastCode(testApp.sms.sent, phone);
  }

  async function confirmPhone(tokens: AuthTokens): Promise<void> {
    await http()
      .put('/v1/auth/phone')
      .set(...bearer(tokens))
      .send({ phone, code: await requestPhoneCode(tokens) })
      .expect(204);
  }

  const chooseChannel = (tokens: AuthTokens, channel: string): request.Test =>
    http()
      .put('/v1/auth/sign-in-confirmation-channel')
      .set(...bearer(tokens))
      .send({ channel });

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    testApp.mail.sent.length = 0;
    testApp.sms.sent.length = 0;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('with a one-time code', () => {
    it('creates the account on the first sign-in', async () => {
      const tokens = await signIn(testApp, email);
      const response = await me(tokens).expect(200);

      expect(response.body).toMatchObject({
        email,
        locale: 'cs',
        emailVerified: true,
        phoneVerified: false,
        hasPassword: false,
        platformRoles: [],
        sellerMemberships: [],
      } satisfies Partial<CurrentUser>);
      expect(tokens.expiresInSeconds).toBe(900);
    });

    it('signs in to the same account the second time', async () => {
      const first = await me(await signIn(testApp, email)).expect(200);
      const second = await me(await signIn(testApp, email)).expect(200);

      expect((second.body as CurrentUser).id).toBe((first.body as CurrentUser).id);
      expect(await testApp.prisma.user.count()).toBe(1);
    });

    it('treats the email as case-insensitive', async () => {
      await signIn(testApp, email);
      await signIn(testApp, 'Jana@Example.CZ');

      expect(await testApp.prisma.user.count()).toBe(1);
    });

    it('writes the email in the language of the app', async () => {
      const subjects: string[] = [];

      for (const locale of ['cs', 'en']) {
        const to = `${locale}@example.cz`;

        await http()
          .post('/v1/auth/email-code')
          .send({ email: to, locale, app: 'web' })
          .expect(200);
        subjects.push(testApp.mail.sent.find((message) => message.to === to)?.subject ?? '');
      }

      expect(subjects[0]).toMatch(/^Kód pro přihlášení do Bluberi: \d{6}$/);
      expect(subjects[1]).toMatch(/^Your Bluberi sign-in code: \d{6}$/);
    });

    it.each([
      ['web', 'Your Bluberi sign-in code'],
      ['seller', 'Your Bluberi Seller sign-in code'],
      ['admin', 'Your Bluberi Admin sign-in code'],
    ])('names the app the person signs in to in the email (%s)', async (app, start) => {
      await http().post('/v1/auth/email-code').send({ email, locale: 'en', app }).expect(200);

      const [message] = testApp.mail.sent;
      const code = lastCode(testApp.mail.sent, email);

      expect(message?.subject).toBe(`${start}: ${code}`);
      expect(message?.text.startsWith(`${start}: ${code}\n\n`)).toBe(true);
    });

    it.each([[{}], [{ app: 'mobile' }], [{ app: '' }]])(
      'does not send a code when the app is missing or unknown (%j)',
      async (app) => {
        const response = await http()
          .post('/v1/auth/email-code')
          .send({ email, locale: 'cs', ...app })
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
        expect(testApp.mail.sent).toHaveLength(0);
      },
    );

    it('speaks only Czech and English', async () => {
      const response = await http()
        .post('/v1/auth/email-code')
        .send({ email, locale: 'ru', app: 'web' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(testApp.mail.sent).toHaveLength(0);
    });

    it('tells how long the code lives and when a new one can be asked for', async () => {
      const response = await http()
        .post('/v1/auth/email-code')
        .send({ email, locale: 'cs', app: 'web' })
        .expect(200);

      expect(response.body).toEqual({ expiresInSeconds: 600, resendInSeconds: 60 });
    });

    it('does not send a second code right after the first', async () => {
      await http()
        .post('/v1/auth/email-code')
        .send({ email, locale: 'cs', app: 'web' })
        .expect(200);

      const response = await http()
        .post('/v1/auth/email-code')
        .send({ email, locale: 'cs', app: 'web' })
        .expect(429);

      expect(response.body).toMatchObject({ code: 'ONE_TIME_CODE_REQUESTED_TOO_SOON' });
      expect(testApp.mail.sent).toHaveLength(1);
    });

    it('refuses a wrong code', async () => {
      const code = await requestEmailCode(testApp, email);
      const wrong = code === '000000' ? '000001' : '000000';
      const response = await http().post('/v1/auth/sign-in/code').send({ email, code: wrong });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'ONE_TIME_CODE_INVALID' });
      expect(await testApp.prisma.user.count()).toBe(0);
    });

    it('accepts a code only once', async () => {
      const code = await requestEmailCode(testApp, email);

      await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(200);
      await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(400);
    });

    it('accepts only the latest code', async () => {
      const first = await requestEmailCode(testApp, email);
      const second = await requestEmailCode(testApp, email);

      if (first !== second) {
        await http().post('/v1/auth/sign-in/code').send({ email, code: first }).expect(400);
      }

      await http().post('/v1/auth/sign-in/code').send({ email, code: second }).expect(200);
    });

    it('refuses an expired code', async () => {
      const code = await requestEmailCode(testApp, email);

      await testApp.prisma.oneTimeCode.updateMany({ data: { expiresAt: longAgo } });
      await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(400);
    });

    it('stops accepting the code after five attempts', async () => {
      const code = await requestEmailCode(testApp, email);
      const wrong = code === '000000' ? '000001' : '000000';

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await http().post('/v1/auth/sign-in/code').send({ email, code: wrong }).expect(400);
      }

      await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(400);
    });

    it('does not accept a code sent to another email', async () => {
      const code = await requestEmailCode(testApp, 'other@example.cz');

      await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(400);
    });

    it('rejects a malformed request', async () => {
      const response = await http()
        .post('/v1/auth/email-code')
        .send({ email: 'not-an-email', locale: 'de', app: 'web' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('the first step', () => {
    const start = (): request.Test =>
      http().post('/v1/auth/sign-in').send({ email, locale: 'cs', app: 'seller' });

    it('sends a code to an email that has no account yet', async () => {
      const response = await start().expect(200);

      expect(response.body).toEqual({
        step: 'EMAIL_CODE',
        code: { expiresInSeconds: 600, resendInSeconds: 60 },
      } satisfies SignInStarted);

      await http()
        .post('/v1/auth/sign-in/code')
        .send({ email, code: lastCode(testApp.mail.sent, email) })
        .expect(200);
    });

    it('names the app in the email with the code', async () => {
      await start().expect(200);

      expect(testApp.mail.sent[0]?.subject).toMatch(
        /^Kód pro přihlášení do Bluberi Seller: \d{6}$/,
      );
    });

    it('sends a code to an account without a password', async () => {
      await signIn(testApp, email);
      testApp.mail.sent.length = 0;

      const response = await start().expect(200);

      expect(response.body).toMatchObject({ step: 'EMAIL_CODE' });
      expect(testApp.mail.sent).toHaveLength(1);
    });

    it('asks for the password of an account that has one and sends nothing', async () => {
      await setPassword(await signIn(testApp, email), password);
      testApp.mail.sent.length = 0;

      const response = await start().expect(200);

      expect(response.body).toEqual({ step: 'PASSWORD', code: null } satisfies SignInStarted);
      expect(testApp.mail.sent).toHaveLength(0);
    });

    it('does not send a second code right after the first, the first one still works', async () => {
      await start().expect(200);
      await start().expect(200);

      expect(testApp.mail.sent).toHaveLength(1);

      await http()
        .post('/v1/auth/sign-in/code')
        .send({ email, code: lastCode(testApp.mail.sent, email) })
        .expect(200);
    });

    it('sends a new code right after the last one was used', async () => {
      await start().expect(200);
      await http()
        .post('/v1/auth/sign-in/code')
        .send({ email, code: lastCode(testApp.mail.sent, email) })
        .expect(200);
      await start().expect(200);

      expect(testApp.mail.sent).toHaveLength(2);
    });

    it('rejects a malformed request', async () => {
      const response = await http()
        .post('/v1/auth/sign-in')
        .send({ email: 'not-an-email', locale: 'de', app: 'seller' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('with a password', () => {
    it('takes two steps: the password, then a code from the email', async () => {
      await setPassword(await signIn(testApp, email), password);
      testApp.mail.sent.length = 0;

      const { confirmationToken, ...sent } = await passwordStep();

      expect(sent).toEqual({
        channel: 'EMAIL',
        phoneEnding: null,
        expiresInSeconds: 600,
        resendInSeconds: 60,
      });
      expect(testApp.mail.sent).toHaveLength(1);

      const response = await confirmation(
        confirmationToken,
        lastCode(testApp.mail.sent, email),
      ).expect(200);
      const current = await me(response.body as AuthTokens).expect(200);

      expect(current.body).toMatchObject({ email, hasPassword: true });
      expect(
        await testApp.prisma.session.count({ where: { signInMethod: SignInMethod.PASSWORD } }),
      ).toBe(1);
    });

    it('does not sign in with the password alone', async () => {
      await setPassword(await signIn(testApp, email), password);

      const sessions = await testApp.prisma.session.count();
      const accepted = await passwordStep();

      expect(accepted).not.toHaveProperty('accessToken');
      expect(accepted).not.toHaveProperty('refreshToken');
      expect(await testApp.prisma.session.count()).toBe(sessions);
      // The token of the first step is not an access token.
      await meWithToken(accepted.confirmationToken).expect(401);
    });

    it('finishes only with the code of the second step', async () => {
      await setPassword(await signIn(testApp, email), password);

      const { confirmationToken } = await passwordStep();
      const confirmationCode = lastCode(testApp.mail.sent, email);
      let signInCode = await requestEmailCode(testApp, email);

      while (signInCode === confirmationCode) {
        signInCode = await requestEmailCode(testApp, email);
      }

      // A code of the sign-in without a password does not finish a sign-in with one.
      const refused = await confirmation(confirmationToken, signInCode).expect(400);

      expect(refused.body).toMatchObject({ code: 'ONE_TIME_CODE_INVALID' });

      // And the code of the second step does not sign in without the password.
      await http()
        .post('/v1/auth/sign-in/code')
        .send({ email, code: confirmationCode })
        .expect(400);
      await confirmation(confirmationToken, confirmationCode).expect(200);
    });

    it('refuses a token that is forged, expired or of another kind', async () => {
      const tokens = await signIn(testApp, email);

      await setPassword(tokens, password);
      await passwordStep();

      const user = await testApp.prisma.user.findUniqueOrThrow({ where: { email } });
      const code = lastCode(testApp.mail.sent, email);
      const tokenSignedWith = (
        key: string | undefined,
        expiresAt: number | string,
        claims: { app?: string } = { app: 'seller' },
      ): Promise<string> =>
        new SignJWT(claims)
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuer('bluberi-api')
          .setAudience('sign-in-confirmation')
          .setSubject(user.id)
          .setExpirationTime(expiresAt)
          .sign(new TextEncoder().encode(key));
      const refusedTokens = [
        await tokenSignedWith('a-key-that-is-not-the-key-of-the-api', '10m'),
        await tokenSignedWith(process.env.ACCESS_TOKEN_SECRET, Math.floor(Date.now() / 1000) - 60),
        // A token that does not say which app the person signs in to, or names one we do not have.
        await tokenSignedWith(process.env.ACCESS_TOKEN_SECRET, '10m', {}),
        await tokenSignedWith(process.env.ACCESS_TOKEN_SECRET, '10m', { app: 'mobile' }),
        tokens.accessToken,
        'not-a-token',
      ];

      for (const confirmationToken of refusedTokens) {
        const response = await confirmation(confirmationToken, code).expect(401);

        expect(response.body).toMatchObject({ code: 'SIGN_IN_CONFIRMATION_EXPIRED' });

        await http()
          .post('/v1/auth/sign-in/confirmation-code')
          .send({ confirmationToken })
          .expect(401);
      }

      // None of them cost an attempt: the code still works with a token of the API.
      await confirmation(
        await tokenSignedWith(process.env.ACCESS_TOKEN_SECRET, '10m'),
        code,
      ).expect(200);
    });

    it('sends the code again on request, but not right after the first', async () => {
      await setPassword(await signIn(testApp, email), password);

      const { confirmationToken } = await passwordStep();
      const first = lastCode(testApp.mail.sent, email);
      const resend = (): request.Test =>
        http().post('/v1/auth/sign-in/confirmation-code').send({ confirmationToken });
      const tooSoon = await resend().expect(429);

      expect(tooSoon.body).toMatchObject({ code: 'ONE_TIME_CODE_REQUESTED_TOO_SOON' });

      await makeCodesOld(testApp, email);

      const again = await resend().expect(200);
      const second = lastCode(testApp.mail.sent, email);

      expect(again.body).toEqual({ expiresInSeconds: 600, resendInSeconds: 60 });
      // The code of the second step and the one sent again both name the app of the first step.
      expect(
        testApp.mail.sent.slice(-2).map(({ subject }) => subject.replace(/\d{6}$/, '')),
      ).toEqual([
        'Kód pro přihlášení do Bluberi Seller: ',
        'Kód pro přihlášení do Bluberi Seller: ',
      ]);

      if (first !== second) {
        await confirmation(confirmationToken, first).expect(400);
      }

      await confirmation(confirmationToken, second).expect(200);
    });

    it('keeps the first code when the password is entered again right away', async () => {
      await setPassword(await signIn(testApp, email), password);
      testApp.mail.sent.length = 0;

      await passwordStep();

      const { confirmationToken } = await passwordStep();

      expect(testApp.mail.sent).toHaveLength(1);

      await confirmation(confirmationToken, lastCode(testApp.mail.sent, email)).expect(200);
    });

    it('sends the code by SMS when the user chose that', async () => {
      const tokens = await signIn(testApp, email);

      await setPassword(tokens, password);
      await confirmPhone(tokens);
      await chooseChannel(tokens, 'SMS').expect(204);
      testApp.mail.sent.length = 0;
      testApp.sms.sent.length = 0;

      const { confirmationToken, channel, phoneEnding } = await passwordStep();

      expect({ channel, phoneEnding }).toEqual({ channel: 'SMS', phoneEnding: '456' });
      expect(testApp.mail.sent).toHaveLength(0);
      expect(testApp.sms.sent).toHaveLength(1);

      await confirmation(confirmationToken, lastCode(testApp.sms.sent, phone)).expect(200);
    });

    it('never stores the password itself', async () => {
      await setPassword(await signIn(testApp, email), password);

      const user = await testApp.prisma.user.findUniqueOrThrow({ where: { email } });

      expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
      expect(user.passwordHash).not.toContain(password);
    });

    it('gives the same answer for a wrong password, an unknown email and an account without a password', async () => {
      await setPassword(await signIn(testApp, email), password);
      await signIn(testApp, 'codes-only@example.cz');

      const attempts = [
        { email, password: 'wrong password 123' },
        { email: 'nobody@example.cz', password },
        { email: 'codes-only@example.cz', password },
      ];

      for (const attempt of attempts) {
        const response = await http()
          .post('/v1/auth/sign-in/password')
          .send({ ...attempt, app: 'seller' })
          .expect(401);

        expect(response.body).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'The email or the password is wrong',
        });
      }
    });

    it('refuses a short password', async () => {
      const tokens = await signIn(testApp, email);
      const response = await http()
        .put('/v1/auth/password')
        .set(...bearer(tokens))
        .send({ newPassword: 'short' })
        .expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('needs the current password when the sign-in with a code was not just now', async () => {
      const tokens = await signIn(testApp, email);

      await setPassword(tokens, password);
      await testApp.prisma.session.updateMany({ data: { createdAt: longAgo } });

      const withoutCurrent = await http()
        .put('/v1/auth/password')
        .set(...bearer(tokens))
        .send({ newPassword: 'another long password' })
        .expect(403);

      expect(withoutCurrent.body).toMatchObject({ code: 'RECENT_SIGN_IN_REQUIRED' });

      await http()
        .put('/v1/auth/password')
        .set(...bearer(tokens))
        .send({ newPassword: 'another long password', currentPassword: 'wrong password 123' })
        .expect(401);
      await http()
        .put('/v1/auth/password')
        .set(...bearer(tokens))
        .send({ newPassword: 'another long password', currentPassword: password })
        .expect(204);
      await signInWithPassword(testApp, email, 'another long password');
      await http()
        .post('/v1/auth/sign-in/password')
        .send({ email, password, app: 'seller' })
        .expect(401);
    });

    it('lets a user who forgot the password set a new one after a sign-in with a code', async () => {
      await setPassword(await signIn(testApp, email), password);
      await setPassword(await signIn(testApp, email), 'a brand new password');

      await signInWithPassword(testApp, email, 'a brand new password');
    });

    it('sends a code for a forgotten password in an email of its own', async () => {
      await setPassword(await signIn(testApp, email), password);
      await makeCodesOld(testApp, email);
      testApp.mail.sent.length = 0;

      const sent = await http()
        .post('/v1/auth/password-reset-code')
        .send({ email, locale: 'en' })
        .expect(200);
      const code = lastCode(testApp.mail.sent, email);

      expect(sent.body).toEqual({ expiresInSeconds: 600, resendInSeconds: 60 });
      expect(testApp.mail.sent).toEqual([
        {
          to: email,
          subject: `Your Bluberi password reset code: ${code}`,
          text: `Your code to set a new Bluberi password: ${code}\n\nThe code is valid for 10 minutes. If you did not ask for a new password, ignore this email. Your password stays as it is.`,
        },
      ]);

      // The code signs in, and the new password is set right after.
      const response = await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(200);

      await setPassword(response.body as AuthTokens, 'a brand new password');
      await signInWithPassword(testApp, email, 'a brand new password');
    });

    it('answers a request for that code the same way for an email without an account', async () => {
      const response = await http()
        .post('/v1/auth/password-reset-code')
        .send({ email: 'nobody@example.cz', locale: 'cs' })
        .expect(200);

      expect(response.body).toEqual({ expiresInSeconds: 600, resendInSeconds: 60 });
      expect(testApp.mail.sent[0]?.subject).toMatch(/^Kód pro nové heslo do Bluberi: \d{6}$/);

      await http().post('/v1/auth/password-reset-code').send({ email: 'not-an-email' }).expect(400);
    });

    it('signs out the other devices when the password changes', async () => {
      const phone = await signIn(testApp, email);
      const laptop = await signIn(testApp, email);

      await setPassword(laptop, password);

      await me(laptop).expect(200);
      await me(phone).expect(401);
    });
  });

  describe('access tokens', () => {
    it('are required on every route that is not public', async () => {
      const response = await http().get('/v1/auth/me').expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('are refused when they are not ours', async () => {
      const tokens = await signIn(testApp, email);
      const session = await testApp.prisma.session.findFirstOrThrow();
      const forged = await new SignJWT({ sid: session.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('bluberi-api')
        .setSubject(session.userId)
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode('a-key-that-is-not-the-key-of-the-api'));

      await meWithToken(forged).expect(401);
      await meWithToken('not-a-token').expect(401);
      await http().get('/v1/auth/me').set('authorization', tokens.accessToken).expect(401);
    });

    it('are refused after they expire', async () => {
      await signIn(testApp, email);

      const session = await testApp.prisma.session.findFirstOrThrow();
      const expired = await new SignJWT({ sid: session.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('bluberi-api')
        .setSubject(session.userId)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
        .sign(new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET));

      await meWithToken(expired).expect(401);
    });

    it('are refused when they have no end', async () => {
      await signIn(testApp, email);

      const session = await testApp.prisma.session.findFirstOrThrow();
      const endless = await new SignJWT({ sid: session.id })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuer('bluberi-api')
        .setSubject(session.userId)
        .sign(new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET));

      await meWithToken(endless).expect(401);
    });

    it('stop working when the account is blocked', async () => {
      const tokens = await signIn(testApp, email);

      await testApp.prisma.user.updateMany({ data: { status: UserStatus.BLOCKED } });

      const response = await me(tokens).expect(403);

      expect(response.body).toMatchObject({ code: 'ACCOUNT_BLOCKED' });
    });
  });

  describe('a blocked account', () => {
    it('cannot sign in or get new tokens', async () => {
      const tokens = await signIn(testApp, email);

      await setPassword(tokens, password);
      await testApp.prisma.user.updateMany({ data: { status: UserStatus.BLOCKED } });

      const code = await requestEmailCode(testApp, email);

      await http().post('/v1/auth/sign-in/code').send({ email, code }).expect(403);
      await http()
        .post('/v1/auth/sign-in/password')
        .send({ email, password, app: 'seller' })
        .expect(403);
      await http().post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(403);
    });

    it('cannot finish a sign-in it started before it was blocked', async () => {
      await setPassword(await signIn(testApp, email), password);

      const { confirmationToken } = await passwordStep();

      await testApp.prisma.user.updateMany({ data: { status: UserStatus.BLOCKED } });

      const response = await confirmation(
        confirmationToken,
        lastCode(testApp.mail.sent, email),
      ).expect(403);

      expect(response.body).toMatchObject({ code: 'ACCOUNT_BLOCKED' });

      await http()
        .post('/v1/auth/sign-in/confirmation-code')
        .send({ confirmationToken })
        .expect(403);
    });
  });

  describe('refresh tokens', () => {
    it('give a new pair of tokens and stop working themselves', async () => {
      const tokens = await signIn(testApp, email);
      const response = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      const refreshed = response.body as AuthTokens;

      expect(refreshed.refreshToken).not.toBe(tokens.refreshToken);
      await me(refreshed).expect(200);
      expect(await testApp.prisma.session.count()).toBe(1);
    });

    it('end the session when a replaced token is used again', async () => {
      const tokens = await signIn(testApp, email);
      const response = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      const refreshed = response.body as AuthTokens;

      const reuse = await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);

      expect(reuse.body).toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
      await me(refreshed).expect(401);
      await http()
        .post('/v1/auth/refresh')
        .send({ refreshToken: refreshed.refreshToken })
        .expect(401);
    });

    it('are refused when unknown or expired', async () => {
      const tokens = await signIn(testApp, email);

      await http().post('/v1/auth/refresh').send({ refreshToken: 'unknown-token' }).expect(401);
      await testApp.prisma.session.updateMany({ data: { expiresAt: longAgo } });
      await http().post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
      await me(tokens).expect(401);
    });

    it('are stored only as a hash', async () => {
      const tokens = await signIn(testApp, email);
      const session = await testApp.prisma.session.findFirstOrThrow();

      expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(session.refreshTokenHash).not.toBe(tokens.refreshToken);
    });
  });

  describe('sign-out', () => {
    it('ends this session at once and leaves the other devices signed in', async () => {
      const phone = await signIn(testApp, email);
      const laptop = await signIn(testApp, email);

      await http()
        .post('/v1/auth/sign-out')
        .set(...bearer(phone))
        .expect(204);

      await me(phone).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(401);
      await me(laptop).expect(200);
    });

    it('on all devices ends every session of the user and nobody else', async () => {
      const phone = await signIn(testApp, email);
      const laptop = await signIn(testApp, email);
      const someoneElse = await signIn(testApp, 'petr@example.cz');

      await http()
        .post('/v1/auth/sign-out-all')
        .set(...bearer(phone))
        .expect(204);

      await me(phone).expect(401);
      await me(laptop).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: laptop.refreshToken }).expect(401);
      await me(someoneElse).expect(200);
    });
  });

  describe('phone number', () => {
    it('is saved after the user enters the code from the SMS', async () => {
      const tokens = await signIn(testApp, email);
      const code = await requestPhoneCode(tokens);

      expect(testApp.sms.sent[0]?.text).toBe(
        `Bluberi: váš ověřovací kód je ${code}. Platí 10 minut.`,
      );

      await http()
        .put('/v1/auth/phone')
        .set(...bearer(tokens))
        .send({ phone, code })
        .expect(204);

      const response = await me(tokens).expect(200);

      expect(response.body).toMatchObject({ phone, phoneVerified: true });
    });

    it('is not saved with a wrong code or a code of another user', async () => {
      const tokens = await signIn(testApp, email);
      const other = await signIn(testApp, 'petr@example.cz');
      const code = await requestPhoneCode(tokens);
      const wrong = code === '000000' ? '000001' : '000000';

      await http()
        .put('/v1/auth/phone')
        .set(...bearer(tokens))
        .send({ phone, code: wrong })
        .expect(400);
      await http()
        .put('/v1/auth/phone')
        .set(...bearer(other))
        .send({ phone, code })
        .expect(400);

      const response = await me(tokens).expect(200);

      expect(response.body).toMatchObject({ phone: null, phoneVerified: false });
    });

    it('cannot belong to two accounts', async () => {
      const first = await signIn(testApp, email);
      const second = await signIn(testApp, 'petr@example.cz');

      await http()
        .put('/v1/auth/phone')
        .set(...bearer(first))
        .send({ phone, code: await requestPhoneCode(first) })
        .expect(204);

      const response = await http()
        .put('/v1/auth/phone')
        .set(...bearer(second))
        .send({ phone, code: await requestPhoneCode(second) })
        .expect(409);

      expect(response.body).toMatchObject({ code: 'PHONE_ALREADY_USED' });
    });

    it('must be in the international format', async () => {
      const tokens = await signIn(testApp, email);

      await http()
        .post('/v1/auth/phone-code')
        .set(...bearer(tokens))
        .send({ phone: '777 123 456' })
        .expect(400);
    });

    it('needs a signed-in user', async () => {
      await http().post('/v1/auth/phone-code').send({ phone }).expect(401);
    });
  });

  describe('the code of the second step', () => {
    it('goes to the email until the user chooses SMS', async () => {
      const response = await me(await signIn(testApp, email)).expect(200);

      expect(response.body).toMatchObject({
        signInConfirmationChannel: 'EMAIL',
      } satisfies Partial<CurrentUser>);
    });

    it('can go by SMS only after the phone number is confirmed', async () => {
      const tokens = await signIn(testApp, email);
      const refused = await chooseChannel(tokens, 'SMS').expect(409);

      expect(refused.body).toMatchObject({ code: 'PHONE_NOT_CONFIRMED' });

      await confirmPhone(tokens);
      await chooseChannel(tokens, 'SMS').expect(204);

      const chosen = await me(tokens).expect(200);

      expect(chosen.body).toMatchObject({ signInConfirmationChannel: 'SMS' });

      await chooseChannel(tokens, 'EMAIL').expect(204);

      const back = await me(tokens).expect(200);

      expect(back.body).toMatchObject({ signInConfirmationChannel: 'EMAIL' });
    });

    it('cannot be sent anywhere else, and the choice needs a signed-in user', async () => {
      const tokens = await signIn(testApp, email);
      const response = await chooseChannel(tokens, 'PIGEON').expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });

      await http()
        .put('/v1/auth/sign-in-confirmation-channel')
        .send({ channel: 'EMAIL' })
        .expect(401);
    });
  });
});
