import request from 'supertest';

import type { AuthTokens } from '../../src/auth/auth.dto.js';
import type { RegistryCompany } from '../../src/company-registry/company-registry.js';
import { PayoutMethod, SellerLegalForm } from '../../src/generated/prisma/enums.js';
import type { SellerRegistration } from '../../src/seller-registration/seller-registration.dto.js';
import { bearer, signInWithSellerAccount } from './actors.js';
import type { TestApp } from './test-app.js';

/** The sample company of the designs, as the register would give it. */
export const studioLila: RegistryCompany = {
  ico: '27082440',
  legalName: 'Studio Lila s.r.o.',
  legalForm: SellerLegalForm.COMPANY,
  vatNumber: 'CZ27082440',
  isVatPayer: true,
  isActive: true,
  address: { street: 'Korunní 2569/108', city: 'Praha 10', postalCode: '10100', countryCode: 'CZ' },
};

/** A file that starts the way every PDF does. What follows does not matter to the API. */
export const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');

export interface RegisteredSeller {
  readonly tokens: AuthTokens;
  readonly sellerId: string;
}

interface SellerToRegister {
  readonly email: string;
  readonly phone: string;
  readonly company: RegistryCompany;
  readonly storeName: string;
  /** What the store sells. */
  readonly categoryIds: readonly string[];
}

/**
 * Takes a person through the registration of a Czech company up to the last step:
 * the company, a bank account, a store and an identity document. Nothing is sent yet.
 */
export async function prepareSeller(
  testApp: TestApp,
  { email, phone, company, storeName, categoryIds }: SellerToRegister,
): Promise<RegisteredSeller> {
  testApp.registry.companies.set(company.ico, company);

  const tokens = await signInWithSellerAccount(testApp, email, phone);
  const http = request(testApp.app.getHttpServer());
  const base = '/v1/seller-registration';
  const authorization = bearer(tokens);

  await http
    .put(`${base}/company`)
    .set(...authorization)
    .send({ ico: company.ico, isVatPayer: company.vatNumber !== null, termsAccepted: true })
    .expect(200);
  await http
    .put(`${base}/payout-method`)
    .set(...authorization)
    .send({ method: PayoutMethod.BANK })
    .expect(200);
  await http
    .put(`${base}/bank-account`)
    .set(...authorization)
    .send({ iban: 'CZ6508000000192000145399', holderName: company.legalName, currency: 'CZK' })
    .expect(200);
  await http
    .post(`${base}/payout-check`)
    .set(...authorization)
    .expect(200);
  await http
    .put(`${base}/store`)
    .set(...authorization)
    .send({ name: storeName, logoImageId: null, categoryIds, returnAddress: null })
    .expect(200);

  const response = await http
    .post(`${base}/documents`)
    .set(...authorization)
    .field('kind', 'IDENTITY_DOCUMENT')
    .field('fileName', 'Občanský průkaz.pdf')
    .attach('file', pdf, 'upload.bin')
    .expect(200);

  return { tokens, sellerId: (response.body as SellerRegistration).seller?.id ?? '' };
}

/** The same, and the registration is sent to Bluberi: the seller waits for the check of the team. */
export async function registerSeller(
  testApp: TestApp,
  seller: SellerToRegister,
): Promise<RegisteredSeller> {
  const registered = await prepareSeller(testApp, seller);

  await request(testApp.app.getHttpServer())
    .post('/v1/seller-registration/submission')
    .set(...bearer(registered.tokens))
    .send({ selfCertified: true })
    .expect(200);

  return registered;
}
