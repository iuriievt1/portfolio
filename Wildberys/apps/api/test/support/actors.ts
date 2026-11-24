import request from 'supertest';

import type { AuthTokens, SignInConfirmation } from '../../src/auth/auth.dto.js';
import {
  SellerLegalForm,
  SellerMemberRole,
  type PlatformRole,
} from '../../src/generated/prisma/enums.js';
import type { TestApp } from './test-app.js';

const codePattern = /\d{6}/;
const twoMinutes = 2 * 60 * 1000;

/** The code from the last email or SMS sent to this address. */
export function lastCode(messages: readonly { to: string; text: string }[], to: string): string {
  const message = messages.findLast((candidate) => candidate.to === to);
  const code = message ? codePattern.exec(message.text)?.[0] : undefined;

  if (!code) {
    throw new Error(`No code was sent to ${to}`);
  }

  return code;
}

/** Makes the codes sent to an address old, so the wait between two codes does not get in the way of a test. */
export async function makeCodesOld(testApp: TestApp, destination: string): Promise<void> {
  await testApp.prisma.oneTimeCode.updateMany({
    where: { destination },
    data: { createdAt: new Date(Date.now() - twoMinutes) },
  });
}

/** Asks for a sign-in code the way the apps do and returns the code from the email. */
export async function requestEmailCode(testApp: TestApp, email: string): Promise<string> {
  // The API stores emails in lowercase.
  const destination = email.toLowerCase();

  await makeCodesOld(testApp, destination);
  await request(testApp.app.getHttpServer())
    .post('/v1/auth/email-code')
    .send({ email, locale: 'cs', app: 'web' })
    .expect(200);

  return lastCode(testApp.mail.sent, destination);
}

/** Signs in with a one-time code. The first sign-in creates the account. */
export async function signIn(testApp: TestApp, email: string): Promise<AuthTokens> {
  const code = await requestEmailCode(testApp, email);
  const response = await request(testApp.app.getHttpServer())
    .post('/v1/auth/sign-in/code')
    .send({ email, code })
    .expect(200);

  return response.body as AuthTokens;
}

/** Signs in with a password: the password first, then the code of the second step from the email. */
export async function signInWithPassword(
  testApp: TestApp,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const destination = email.toLowerCase();

  await makeCodesOld(testApp, destination);

  const accepted = await request(testApp.app.getHttpServer())
    .post('/v1/auth/sign-in/password')
    .send({ email, password, app: 'seller' })
    .expect(200);
  const { confirmationToken } = accepted.body as SignInConfirmation;
  const response = await request(testApp.app.getHttpServer())
    .post('/v1/auth/sign-in/confirmation')
    .send({ confirmationToken, code: lastCode(testApp.mail.sent, destination) })
    .expect(200);

  return response.body as AuthTokens;
}

export function bearer(tokens: AuthTokens): [string, string] {
  return ['authorization', `Bearer ${tokens.accessToken}`];
}

/**
 * A signed-in person whose account is ready to register a seller:
 * it has a password and a phone number confirmed with a code from an SMS.
 */
export async function signInWithSellerAccount(
  testApp: TestApp,
  email: string,
  phone: string,
): Promise<AuthTokens> {
  const tokens = await signIn(testApp, email);
  const http = request(testApp.app.getHttpServer());

  await http
    .post('/v1/auth/phone-code')
    .set(...bearer(tokens))
    .send({ phone })
    .expect(200);
  await http
    .put('/v1/auth/phone')
    .set(...bearer(tokens))
    .send({ phone, code: lastCode(testApp.sms.sent, phone) })
    .expect(204);
  await http
    .put('/v1/auth/password')
    .set(...bearer(tokens))
    .send({ newPassword: 'a-long-test-password' })
    .expect(204);

  return tokens;
}

async function userId(testApp: TestApp, email: string): Promise<string> {
  const user = await testApp.prisma.user.findUniqueOrThrow({ where: { email } });

  return user.id;
}

/** A signed-in member of the Bluberi team with these roles. */
export async function signInTeamMember(
  testApp: TestApp,
  email: string,
  roles: readonly PlatformRole[],
): Promise<AuthTokens> {
  const tokens = await signIn(testApp, email);
  const id = await userId(testApp, email);

  await testApp.prisma.userPlatformRole.createMany({
    data: roles.map((role) => ({ userId: id, role })),
  });

  return tokens;
}

/** A seller with one owner. Returns the seller id. */
export async function createSeller(testApp: TestApp, ownerEmail: string): Promise<string> {
  const seller = await testApp.prisma.seller.create({
    data: {
      legalName: 'Studio Lila s.r.o.',
      legalForm: SellerLegalForm.COMPANY,
      countryCode: 'CZ',
      registrationNumber: String(Math.floor(Math.random() * 1e8)).padStart(8, '0'),
      contactEmail: ownerEmail,
      contactPhone: '+420777123456',
      termsAcceptedAt: new Date(),
      companyCheck: 'COMPANY_REGISTER',
      registeredAddress: {
        create: {
          street: 'Korunní 2569/108',
          city: 'Praha',
          postalCode: '10100',
          countryCode: 'CZ',
        },
      },
      members: {
        create: { userId: await userId(testApp, ownerEmail), role: SellerMemberRole.OWNER },
      },
    },
  });

  return seller.id;
}

export async function addSellerStaff(
  testApp: TestApp,
  sellerId: string,
  email: string,
): Promise<void> {
  await testApp.prisma.sellerMember.create({
    data: { sellerId, userId: await userId(testApp, email), role: SellerMemberRole.STAFF },
  });
}
