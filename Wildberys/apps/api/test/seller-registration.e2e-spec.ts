import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthTokens } from '../src/auth/auth.dto.js';
import type { RegistryCompany } from '../src/company-registry/company-registry.js';
import {
  PayoutAccountStatus,
  PayoutMethod,
  SellerLegalForm,
  SellerMemberRole,
  SellerStatus,
} from '../src/generated/prisma/enums.js';
import type { SellerRegistration } from '../src/seller-registration/seller-registration.dto.js';
import type { VatRecord } from '../src/vat-registry/vat-registry.js';
import { bearer, signIn, signInWithSellerAccount } from './support/actors.js';
import { createCategories, type TestCategories } from './support/catalog.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const email = 'jana@studiolila.cz';
const phone = '+420777123456';
const otherEmail = 'petr@ateliernord.cz';
const otherPhone = '+420602111222';

/** The sample company of the designs, as the register would give it. */
const studioLila: RegistryCompany = {
  ico: '27082440',
  legalName: 'Studio Lila s.r.o.',
  legalForm: SellerLegalForm.COMPANY,
  vatNumber: 'CZ27082440',
  isVatPayer: true,
  isActive: true,
  address: { street: 'Korunní 2569/108', city: 'Praha 10', postalCode: '10100', countryCode: 'CZ' },
};
/** A sole trader without a tax number. */
const atelierNord: RegistryCompany = {
  ico: '25596641',
  legalName: 'Petr Nord',
  legalForm: SellerLegalForm.SOLE_TRADER,
  vatNumber: null,
  isVatPayer: false,
  isActive: true,
  address: { street: 'Rožkovo údolí 2865', city: 'Mělník', postalCode: '27601', countryCode: 'CZ' },
};
/** A company the register lists as closed. Its number has a right check digit. */
const closedCompany: RegistryCompany = { ...studioLila, ico: '00006947', isActive: false };

/** What the API shows of a company of the register. */
function asShown({ ico, legalName, legalForm, vatNumber, isVatPayer, address }: RegistryCompany) {
  return { ico, legalName, legalForm, vatNumber, isVatPayer, address };
}

/** What the registration shows of a Czech company it saved. */
function asRegistered(company: RegistryCompany) {
  const { ico, ...rest } = asShown(company);

  return { countryCode: 'CZ', registrationNumber: ico, ...rest, check: 'COMPANY_REGISTER' };
}

/** A Polish VAT number as the register of VAT numbers would give it. */
const atelierWislaVat: VatRecord = {
  vatNumber: 'PL1234563218',
  name: 'ATELIER WISŁA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
  address: 'UL. PIĘKNA 12, 00-549 WARSZAWA',
};
/** What the seller writes about that company. */
const atelierWisla = {
  countryCode: 'PL',
  vatNumber: '1234563218',
  registrationNumber: '0000123456',
  legalName: 'Atelier Wisła sp. z o.o.',
  legalForm: SellerLegalForm.COMPANY,
  address: { street: 'ul. Piękna 12', city: 'Warszawa', postalCode: '00-549' },
  termsAccepted: true,
};
/** A Spanish number: Spain shares neither names nor addresses. */
const tallerSolVat: VatRecord = { vatNumber: 'ESB12345674', name: null, address: null };
const tallerSol = {
  ...atelierWisla,
  countryCode: 'ES',
  vatNumber: 'B12345674',
  registrationNumber: 'M-123456',
  legalName: 'Taller Sol S.L.',
  address: { street: 'Calle de Atocha 27', city: 'Madrid', postalCode: '28012' },
};
/** The countries of the registration, as every answer lists them. */
const countries = [
  ...['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU'],
  ...['IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'],
];
const iban = 'CZ6508000000192000145399';
const bankAccount = { iban, holderName: 'Studio Lila s.r.o.', currency: 'CZK' };
const ownReturnAddress = { street: 'Vinohradská 12', city: 'Praha 2', postalCode: '12000' };
/** A file that starts the way every PDF does. What follows does not matter to the API. */
const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');

describe('Seller registration', () => {
  let testApp: TestApp;
  let categories: TestCategories;
  /** A store that sells everything for women and sends goods back to the registered address. */
  let store: {
    name: string;
    logoImageId: string | null;
    categoryIds: string[];
    returnAddress: null;
  };

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());
  const state = (tokens: AuthTokens): request.Test =>
    http()
      .get('/v1/seller-registration')
      .set(...bearer(tokens));
  const put = (tokens: AuthTokens, step: string, body: object): request.Test =>
    http()
      .put(`/v1/seller-registration/${step}`)
      .set(...bearer(tokens))
      .send(body);
  const post = (tokens: AuthTokens, step: string, body: object = {}): request.Test =>
    http()
      .post(`/v1/seller-registration/${step}`)
      .set(...bearer(tokens))
      .send(body);
  /** Sends the registration with the promise to offer only goods that comply with the law. */
  const submit = (tokens: AuthTokens): request.Test =>
    post(tokens, 'submission', { selfCertified: true });
  const addDocument = (
    tokens: AuthTokens,
    kind: string,
    file: Buffer = pdf,
    fileName = 'doklad.pdf',
  ): request.Test =>
    http()
      .post('/v1/seller-registration/documents')
      .set(...bearer(tokens))
      .field('kind', kind)
      .field('fileName', fileName)
      .attach('file', file, 'upload.bin');
  const registration = (response: request.Response): SellerRegistration =>
    response.body as SellerRegistration;
  const company = (ico = studioLila.ico, isVatPayer = true): object => ({
    ico,
    isVatPayer,
    termsAccepted: true,
  });
  const actions = async (): Promise<string[]> => {
    const entries = await testApp.prisma.auditLogEntry.findMany({
      where: { action: { startsWith: 'seller.' } },
      orderBy: { id: 'asc' },
    });

    return entries.map(({ action }) => action);
  };

  /** A person with a ready account and a registered company. */
  async function withCompany(): Promise<AuthTokens> {
    const tokens = await signInWithSellerAccount(testApp, email, phone);

    await put(tokens, 'company', company()).expect(200);

    return tokens;
  }

  /** A person whose registration lacks nothing and is not sent yet. */
  async function readyToSubmit(): Promise<AuthTokens> {
    const tokens = await withCompany();

    await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
    await put(tokens, 'bank-account', bankAccount).expect(200);
    await post(tokens, 'payout-check').expect(200);
    await put(tokens, 'store', store).expect(200);
    await addDocument(tokens, 'IDENTITY_DOCUMENT').expect(200);

    return tokens;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    testApp.mail.sent.length = 0;
    testApp.sms.sent.length = 0;
    testApp.registry.reset();
    testApp.vatRegistry.reset();
    testApp.payouts.reset();
    testApp.registry.companies.set(studioLila.ico, studioLila);
    testApp.registry.companies.set(atelierNord.ico, atelierNord);
    testApp.registry.companies.set(closedCompany.ico, closedCompany);
    testApp.vatRegistry.records.set(atelierWislaVat.vatNumber, atelierWislaVat);
    testApp.vatRegistry.records.set(tallerSolVat.vatNumber, tallerSolVat);
    categories = await createCategories(testApp);
    store = {
      name: 'Studio Lila',
      logoImageId: null,
      categoryIds: [categories.women],
      returnAddress: null,
    };
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('every step', () => {
    it.each([
      ['get', ''],
      ['put', '/company'],
      ['put', '/eu-company'],
      ['put', '/payout-method'],
      ['put', '/bank-account'],
      ['post', '/payout-check'],
      ['put', '/store'],
      ['post', '/documents'],
      ['delete', '/documents/0193a7c2-0000-7000-8000-000000000001'],
      ['post', '/submission'],
      ['post', '/resubmission'],
    ] as const)('needs a signed-in person: %s %s', async (method, path) => {
      const response = await http()[method](`/v1/seller-registration${path}`).expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });
  });

  describe('the state', () => {
    it('of a new account has no seller and names what the account lacks', async () => {
      const tokens = await signIn(testApp, email);
      const response = await state(tokens).expect(200);

      expect(response.body).toEqual({
        account: { email, phone: null, phoneVerified: false, hasPassword: false },
        seller: null,
        portalOpen: false,
        countries,
      });
    });

    it('of a ready account says so', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await state(tokens).expect(200);

      expect(response.body).toEqual({
        account: { email, phone, phoneVerified: true, hasPassword: true },
        seller: null,
        portalOpen: false,
        countries,
      });
    });

    it('belongs to one person: another account sees nothing of it', async () => {
      await readyToSubmit();

      const stranger = await signInWithSellerAccount(testApp, otherEmail, otherPhone);
      const response = await state(stranger).expect(200);

      expect(registration(response).seller).toBeNull();
      await put(stranger, 'store', store).expect(409);
      await submit(stranger).expect(409);
    });
  });

  describe('the company', () => {
    it('is not registered for an account without a password and a confirmed phone', async () => {
      const tokens = await signIn(testApp, email);
      const response = await put(tokens, 'company', company()).expect(409);

      expect(response.body).toMatchObject({ code: 'ACCOUNT_NOT_READY' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is read from the register and saved as a draft of a seller', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const before = Date.now();
      const response = await put(tokens, 'company', company()).expect(200);
      const seller = await testApp.prisma.seller.findFirstOrThrow({
        include: { registeredAddress: true, members: true },
      });

      expect(registration(response)).toEqual({
        account: { email, phone, phoneVerified: true, hasPassword: true },
        seller: {
          id: seller.id,
          status: SellerStatus.DRAFT,
          reviewMessage: null,
          company: asRegistered(studioLila),
          payoutAccount: null,
          store: null,
          documents: [],
          requiredDocuments: ['IDENTITY_DOCUMENT'],
        },
        portalOpen: false,
        countries,
      });
      expect(seller).toMatchObject({
        legalName: 'Studio Lila s.r.o.',
        legalForm: SellerLegalForm.COMPANY,
        countryCode: 'CZ',
        registrationNumber: '27082440',
        vatNumber: 'CZ27082440',
        isVatPayer: true,
        contactEmail: email,
        contactPhone: phone,
        status: SellerStatus.DRAFT,
        registeredAddress: studioLila.address,
      });
      expect(seller.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(seller.members).toMatchObject([{ role: SellerMemberRole.OWNER }]);
      expect(await actions()).toEqual(['seller.registration_started']);
    });

    it('of a sole trader is saved without a tax number', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'company', company(atelierNord.ico, false)).expect(200);

      expect(registration(response).seller?.company).toMatchObject({
        legalForm: SellerLegalForm.SOLE_TRADER,
        vatNumber: null,
        isVatPayer: false,
      });
    });

    it('keeps what the seller says about VAT when the register has a tax number', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'company', company(studioLila.ico, false)).expect(200);

      expect(registration(response).seller?.company).toMatchObject({
        vatNumber: 'CZ27082440',
        isVatPayer: false,
      });
    });

    it('cannot pay VAT without a tax number in the register', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'company', company(atelierNord.ico, true)).expect(409);

      expect(response.body).toMatchObject({ code: 'VAT_NUMBER_MISSING' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it.each([
      ['a number with a wrong check digit', { ico: '27082441' }],
      ['no number', { ico: undefined }],
      ['no word about VAT', { isVatPayer: undefined }],
      ['terms that were not accepted', { termsAccepted: false }],
      ['no word about the terms', { termsAccepted: undefined }],
      ['a name typed by hand', { legalName: 'Somebody Else s.r.o.' }],
    ])('is not registered with %s', async (_what, change) => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'company', { ...company(), ...change }).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is not registered when the register does not know the number', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      testApp.registry.companies.clear();

      const response = await put(tokens, 'company', company()).expect(404);

      expect(response.body).toMatchObject({ code: 'COMPANY_NOT_FOUND' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is not registered when it was closed', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'company', company(closedCompany.ico)).expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_NOT_ACTIVE' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is not registered while the register does not answer', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      testApp.registry.available = false;

      const response = await put(tokens, 'company', company()).expect(503);

      expect(response.body).toMatchObject({ code: 'COMPANY_REGISTRY_UNAVAILABLE' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('belongs to one seller: another person cannot register it', async () => {
      await withCompany();

      const stranger = await signInWithSellerAccount(testApp, otherEmail, otherPhone);
      const response = await put(stranger, 'company', company()).expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_ALREADY_REGISTERED' });
      expect(await testApp.prisma.seller.count()).toBe(1);
    });

    it('sent again with the same number changes the draft and makes no second seller', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'company', company(studioLila.ico, false)).expect(200);

      expect(registration(response).seller?.company).toMatchObject({ isVatPayer: false });
      expect(await testApp.prisma.seller.count()).toBe(1);
      expect(await testApp.prisma.address.count()).toBe(1);
      expect(await actions()).toEqual(['seller.registration_started']);
    });

    it('can be replaced by another one, and the payouts are chosen again', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'bank-account', bankAccount).expect(200);

      const response = await put(tokens, 'company', company(atelierNord.ico, false)).expect(200);

      expect(registration(response).seller).toMatchObject({
        company: asRegistered(atelierNord),
        payoutAccount: null,
      });
      expect(await testApp.prisma.seller.count()).toBe(1);
      expect(await testApp.prisma.sellerPayoutAccount.count()).toBe(0);
      expect(testApp.payouts.closed).toEqual(['acct_test_1']);
      expect(await actions()).toEqual([
        'seller.registration_started',
        'seller.payout_method_chosen',
        'seller.bank_account_saved',
        'seller.registration_started',
      ]);
    });
  });

  describe('a company from another EU country', () => {
    /** What the registration shows of the Polish company once it is saved. */
    const atelierWislaSaved = {
      countryCode: 'PL',
      registrationNumber: '0000123456',
      legalName: 'ATELIER WISŁA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      legalForm: SellerLegalForm.COMPANY,
      vatNumber: 'PL1234563218',
      isVatPayer: true,
      address: {
        street: 'ul. Piękna 12',
        city: 'Warszawa',
        postalCode: '00-549',
        countryCode: 'PL',
      },
      check: 'VAT_REGISTER',
    };

    it('is not registered for an account without a password and a confirmed phone', async () => {
      const tokens = await signIn(testApp, email);
      const response = await put(tokens, 'eu-company', atelierWisla).expect(409);

      expect(response.body).toMatchObject({ code: 'ACCOUNT_NOT_READY' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is saved with the name of the register and what the seller wrote', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', atelierWisla).expect(200);
      const seller = await testApp.prisma.seller.findFirstOrThrow({
        include: { registeredAddress: true, members: true },
      });
      const [entry] = await testApp.prisma.auditLogEntry.findMany({
        where: { action: 'seller.registration_started' },
      });

      expect(registration(response).seller).toEqual({
        id: seller.id,
        status: SellerStatus.DRAFT,
        reviewMessage: null,
        company: atelierWislaSaved,
        payoutAccount: null,
        store: null,
        documents: [],
        requiredDocuments: ['IDENTITY_DOCUMENT', 'REGISTER_EXTRACT'],
      });
      expect(seller).toMatchObject({
        countryCode: 'PL',
        registrationNumber: '0000123456',
        vatNumber: 'PL1234563218',
        isVatPayer: true,
        contactEmail: email,
        contactPhone: phone,
        registeredAddress: atelierWislaSaved.address,
      });
      expect(seller.members).toMatchObject([{ role: SellerMemberRole.OWNER }]);
      expect(entry?.details).toEqual({ countryCode: 'PL', registrationNumber: '0000123456' });
    });

    it('keeps the name the seller wrote when the register does not share names', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', {
        ...tallerSol,
        legalForm: SellerLegalForm.SOLE_TRADER,
      }).expect(200);

      expect(registration(response).seller?.company).toMatchObject({
        countryCode: 'ES',
        legalName: 'Taller Sol S.L.',
        legalForm: SellerLegalForm.SOLE_TRADER,
        vatNumber: 'ESB12345674',
      });
    });

    it('tidies the numbers and the texts a person typed', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', {
        ...tallerSol,
        registrationNumber: '  m-123456  ',
        legalName: '  Taller Sol S.L. ',
        address: { street: ' Calle de Atocha 27 ', city: ' Madrid ', postalCode: ' 28012 ' },
      }).expect(200);

      expect(registration(response).seller?.company).toMatchObject({
        registrationNumber: 'M-123456',
        legalName: 'Taller Sol S.L.',
        address: { street: 'Calle de Atocha 27', city: 'Madrid', postalCode: '28012' },
      });
    });

    it.each([
      ['a Czech company, which is registered by its number', { countryCode: 'CZ' }],
      ['a country outside the EU', { countryCode: 'UA' }],
      ['no country', { countryCode: undefined }],
      ['no VAT number', { vatNumber: undefined }],
      ['a VAT number with a space', { vatNumber: '123 456 32 18' }],
      ['a VAT number in small letters', { vatNumber: 'b12345674' }],
      ['no registration number', { registrationNumber: undefined }],
      ['a registration number of one character', { registrationNumber: '7' }],
      ['a registration number with a strange character', { registrationNumber: '0000_123456' }],
      ['no name', { legalName: undefined }],
      ['a name of one letter', { legalName: 'A' }],
      ['a legal form nobody knows', { legalForm: 'FOUNDATION' }],
      ['no address', { address: undefined }],
      ['an address without a street', { address: { ...atelierWisla.address, street: '' } }],
      ['an address without a city', { address: { ...atelierWisla.address, city: undefined } }],
      [
        'a postal code nobody writes',
        { address: { ...atelierWisla.address, postalCode: '00_549' } },
      ],
      [
        'an address in a country typed by hand',
        { address: { ...atelierWisla.address, countryCode: 'DE' } },
      ],
      ['terms that were not accepted', { termsAccepted: false }],
      ['a word about VAT, which the register answers', { isVatPayer: false }],
    ])('is not registered with %s', async (_what, change) => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', { ...atelierWisla, ...change }).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is not registered when the register says the VAT number is not valid', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', {
        ...atelierWisla,
        vatNumber: '9999999999',
      }).expect(404);

      expect(response.body).toMatchObject({ code: 'VAT_NUMBER_NOT_FOUND' });
      expect(await testApp.prisma.seller.count()).toBe(0);
    });

    it('is not registered with a VAT number of another country', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', {
        ...atelierWisla,
        countryCode: 'SK',
      }).expect(404);

      expect(response.body).toMatchObject({ code: 'VAT_NUMBER_NOT_FOUND' });
    });

    it('is taken without the check while the register does not answer, for the team to check', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      testApp.vatRegistry.available = false;

      const response = await put(tokens, 'eu-company', atelierWisla).expect(200);

      expect(registration(response).seller?.company).toMatchObject({
        legalName: 'Atelier Wisła sp. z o.o.',
        vatNumber: 'PL1234563218',
        isVatPayer: true,
        check: 'DOCUMENTS',
      });
    });

    it('of a trader without a VAT number is taken for the team to check', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'eu-company', {
        ...atelierWisla,
        vatNumber: null,
        legalForm: SellerLegalForm.SOLE_TRADER,
      }).expect(200);

      expect(registration(response).seller?.company).toMatchObject({
        legalName: 'Atelier Wisła sp. z o.o.',
        legalForm: SellerLegalForm.SOLE_TRADER,
        vatNumber: null,
        isVatPayer: false,
        check: 'DOCUMENTS',
      });
    });

    it('of a trader without a VAT number does not clash with other sellers who have none', async () => {
      const czechTrader = await signInWithSellerAccount(testApp, otherEmail, otherPhone);

      await put(czechTrader, 'company', company(atelierNord.ico, false)).expect(200);

      const tokens = await signInWithSellerAccount(testApp, email, phone);

      await put(tokens, 'eu-company', { ...atelierWisla, vatNumber: null }).expect(200);
      await put(tokens, 'eu-company', {
        ...atelierWisla,
        vatNumber: null,
        legalName: 'Atelier Wisła',
      }).expect(200);
      expect(await testApp.prisma.seller.count()).toBe(2);
    });

    it('keeps a Greek number that could not be checked with the letters such numbers have', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      testApp.vatRegistry.available = false;

      const response = await put(tokens, 'eu-company', {
        ...atelierWisla,
        countryCode: 'GR',
        vatNumber: '094014201',
      }).expect(200);

      expect(registration(response).seller?.company.vatNumber).toBe('EL094014201');
    });

    it('belongs to one seller: another person cannot register it', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const stranger = await signInWithSellerAccount(testApp, otherEmail, otherPhone);

      await put(tokens, 'eu-company', atelierWisla).expect(200);

      const response = await put(stranger, 'eu-company', atelierWisla).expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_ALREADY_REGISTERED' });
      expect(await testApp.prisma.seller.count()).toBe(1);
    });

    it('belongs to one seller under another registration number too', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const stranger = await signInWithSellerAccount(testApp, otherEmail, otherPhone);

      await put(tokens, 'eu-company', atelierWisla).expect(200);

      const response = await put(stranger, 'eu-company', {
        ...atelierWisla,
        registrationNumber: 'KRS 0000123456',
      }).expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_ALREADY_REGISTERED' });
      expect(await testApp.prisma.seller.count()).toBe(1);
    });

    it('sent again changes the draft and makes no second seller', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      await put(tokens, 'eu-company', atelierWisla).expect(200);

      const response = await put(tokens, 'eu-company', {
        ...atelierWisla,
        address: { ...atelierWisla.address, street: 'ul. Piękna 14' },
      }).expect(200);

      expect(registration(response).seller?.company.address).toMatchObject({
        street: 'ul. Piękna 14',
      });
      expect(await testApp.prisma.seller.count()).toBe(1);
      expect(await testApp.prisma.address.count()).toBe(1);
      expect(await actions()).toEqual(['seller.registration_started']);
    });

    it('can take the place of a Czech company, and what belonged to that country goes', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'store', { ...store, returnAddress: ownReturnAddress }).expect(200);

      const response = await put(tokens, 'eu-company', atelierWisla).expect(200);
      const saved = await testApp.prisma.store.findFirstOrThrow({ include: { seller: true } });

      expect(registration(response).seller).toMatchObject({
        company: atelierWislaSaved,
        payoutAccount: null,
        store: { name: 'Studio Lila', returnAddress: null },
      });
      expect(saved.returnAddressId).toBe(saved.seller.registeredAddressId);
      expect(await testApp.prisma.seller.count()).toBe(1);
      expect(await testApp.prisma.address.count()).toBe(1);
      expect(testApp.payouts.closed).toEqual(['acct_test_1']);
    });

    it('can be replaced by a Czech company', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      await put(tokens, 'eu-company', atelierWisla).expect(200);

      const response = await put(tokens, 'company', company()).expect(200);

      expect(registration(response).seller?.company).toEqual(asRegistered(studioLila));
      expect(await testApp.prisma.seller.count()).toBe(1);
      expect(await actions()).toEqual([
        'seller.registration_started',
        'seller.registration_started',
      ]);
    });

    it('sends returned goods to an address in its own country', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      await put(tokens, 'eu-company', atelierWisla).expect(200);

      const returnAddress = { street: 'ul. Długa 5', city: 'Kraków', postalCode: '31-147' };
      const response = await put(tokens, 'store', { ...store, returnAddress }).expect(200);
      const saved = await testApp.prisma.store.findFirstOrThrow({
        include: { returnAddress: true },
      });

      expect(registration(response).seller?.store?.returnAddress).toEqual(returnAddress);
      expect(saved.returnAddress).toMatchObject({ ...returnAddress, countryCode: 'PL' });
    });
  });

  describe('the way of getting paid', () => {
    it('cannot be chosen before the company is registered', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(
        409,
      );

      expect(response.body).toMatchObject({ code: 'COMPANY_REQUIRED' });
      expect(testApp.payouts.opened).toHaveLength(0);
    });

    it.each([PayoutMethod.STRIPE, PayoutMethod.BANK])(
      'opens an account at the provider: %s',
      async (method) => {
        const tokens = await withCompany();
        const response = await put(tokens, 'payout-method', { method }).expect(200);
        const sellerId = registration(response).seller?.id;

        expect(registration(response).seller?.payoutAccount).toEqual({
          method,
          status: PayoutAccountStatus.INCOMPLETE,
          bankAccount: null,
        });
        expect(testApp.payouts.opened).toEqual([{ accountId: 'acct_test_1', method, sellerId }]);
        expect(await testApp.prisma.sellerPayoutAccount.findFirstOrThrow()).toMatchObject({
          sellerId,
          method,
          providerAccountId: 'acct_test_1',
          submittedAt: null,
        });
        expect(await actions()).toEqual([
          'seller.registration_started',
          'seller.payout_method_chosen',
        ]);
      },
    );

    it('chosen twice opens one account', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);

      expect(testApp.payouts.opened).toHaveLength(1);
      expect(testApp.payouts.closed).toHaveLength(0);
    });

    it('changed opens a new account, closes the old one and starts the form again', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'bank-account', bankAccount).expect(200);
      await post(tokens, 'payout-check').expect(200);

      const response = await put(tokens, 'payout-method', { method: PayoutMethod.STRIPE }).expect(
        200,
      );

      expect(registration(response).seller?.payoutAccount).toEqual({
        method: PayoutMethod.STRIPE,
        status: PayoutAccountStatus.INCOMPLETE,
        bankAccount: null,
      });
      expect(testApp.payouts.opened.map(({ accountId }) => accountId)).toEqual([
        'acct_test_1',
        'acct_test_2',
      ]);
      expect(testApp.payouts.closed).toEqual(['acct_test_1']);
      expect(await testApp.prisma.sellerPayoutAccount.count()).toBe(1);
    });

    it.each([
      ['a way that does not exist', { method: 'CASH' }],
      ['no way', {}],
      ['a field the API does not know', { method: PayoutMethod.BANK, iban }],
    ])('is not chosen with %s', async (_what, body) => {
      const tokens = await withCompany();
      const response = await put(tokens, 'payout-method', body).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(testApp.payouts.opened).toHaveLength(0);
    });
  });

  describe('the bank account', () => {
    it('needs a chosen way of getting paid', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'bank-account', bankAccount).expect(409);

      expect(response.body).toMatchObject({ code: 'PAYOUT_METHOD_REQUIRED' });
    });

    it('is not taken from a seller who is paid through Stripe', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.STRIPE }).expect(200);

      const response = await put(tokens, 'bank-account', bankAccount).expect(409);

      expect(response.body).toMatchObject({ code: 'PAYOUT_METHOD_NOT_BANK' });
      expect(testApp.payouts.bankAccounts).toHaveLength(0);
    });

    it('goes to the provider whole, and only its end is kept', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);

      const response = await put(tokens, 'bank-account', {
        iban,
        holderName: '  Studio Lila s.r.o. ',
        currency: 'CZK',
      }).expect(200);
      const saved = await testApp.prisma.sellerPayoutAccount.findFirstOrThrow();
      const entry = await testApp.prisma.auditLogEntry.findFirstOrThrow({
        where: { action: 'seller.bank_account_saved' },
      });

      expect(registration(response).seller?.payoutAccount).toEqual({
        method: PayoutMethod.BANK,
        status: PayoutAccountStatus.INCOMPLETE,
        bankAccount: {
          holderName: 'Studio Lila s.r.o.',
          country: 'CZ',
          last4: '5399',
          currency: 'CZK',
        },
      });
      expect(testApp.payouts.bankAccounts).toEqual([
        { accountId: 'acct_test_1', iban, holderName: 'Studio Lila s.r.o.', currency: 'CZK' },
      ]);
      expect(JSON.stringify(saved)).not.toContain(iban);
      expect(entry).toMatchObject({
        targetType: 'seller',
        targetId: saved.sellerId,
        details: { country: 'CZ', last4: '5399', currency: 'CZK' },
      });
      expect(JSON.stringify(response.body)).not.toContain(iban);
    });

    it('can be an account in euros in another country', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);

      const response = await put(tokens, 'bank-account', {
        iban: 'SK3112000000198742637541',
        holderName: 'Studio Lila s.r.o.',
        currency: 'EUR',
      }).expect(200);

      expect(registration(response).seller?.payoutAccount?.bankAccount).toEqual({
        holderName: 'Studio Lila s.r.o.',
        country: 'SK',
        last4: '7541',
        currency: 'EUR',
      });
    });

    it.each([
      ['a number with a wrong check digit', { iban: 'CZ6508000000192000145398' }],
      ['a number with spaces', { iban: 'CZ65 0800 0000 1920 0014 5399' }],
      ['no number', { iban: undefined }],
      ['a holder of one letter', { holderName: 'A' }],
      ['no holder', { holderName: undefined }],
      ['no currency', { currency: undefined }],
      ['a currency Bluberi does not pay in', { currency: 'USD' }],
      ['a field the API does not know', { bankName: 'Česká spořitelna' }],
    ])('is not saved with %s', async (_what, change) => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);

      const response = await put(tokens, 'bank-account', { ...bankAccount, ...change }).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(testApp.payouts.bankAccounts).toHaveLength(0);
    });
  });

  describe('the check of the provider', () => {
    it('needs a chosen way of getting paid', async () => {
      const tokens = await withCompany();
      const response = await post(tokens, 'payout-check').expect(409);

      expect(response.body).toMatchObject({ code: 'PAYOUT_METHOD_REQUIRED' });
    });

    it('does not start for a bank account that was not given', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);

      const response = await post(tokens, 'payout-check').expect(409);

      expect(response.body).toMatchObject({ code: 'BANK_ACCOUNT_REQUIRED' });
    });

    it('starts when a seller with a Stripe account finishes the form', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.STRIPE }).expect(200);

      const before = Date.now();
      const response = await post(tokens, 'payout-check').expect(200);
      const saved = await testApp.prisma.sellerPayoutAccount.findFirstOrThrow();

      expect(registration(response).seller?.payoutAccount).toMatchObject({
        method: PayoutMethod.STRIPE,
        status: PayoutAccountStatus.PENDING,
      });
      expect(saved.submittedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it('is shown as passed once the provider says so', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'bank-account', bankAccount).expect(200);
      await post(tokens, 'payout-check').expect(200);

      const waiting = await state(tokens).expect(200);

      testApp.payouts.checkResult = PayoutAccountStatus.VERIFIED;

      const passed = await state(tokens).expect(200);

      expect(registration(waiting).seller?.payoutAccount?.status).toBe(PayoutAccountStatus.PENDING);
      expect(registration(passed).seller?.payoutAccount?.status).toBe(PayoutAccountStatus.VERIFIED);
      expect(await testApp.prisma.sellerPayoutAccount.findFirstOrThrow()).toMatchObject({
        status: PayoutAccountStatus.VERIFIED,
      });
    });

    it('keeps the time the form was finished when it is asked again', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.STRIPE }).expect(200);
      await post(tokens, 'payout-check').expect(200);

      const first = await testApp.prisma.sellerPayoutAccount.findFirstOrThrow();

      await post(tokens, 'payout-check').expect(200);

      const second = await testApp.prisma.sellerPayoutAccount.findFirstOrThrow();

      expect(second.submittedAt).toEqual(first.submittedAt);
    });
  });

  describe('the store', () => {
    it('cannot be set up before the company is registered', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await put(tokens, 'store', store).expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_REQUIRED' });
    });

    it('gets its address from its name and sends goods back to the registered address', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', { ...store, name: '  Studio Lila ' }).expect(200);
      const saved = await testApp.prisma.store.findFirstOrThrow({ include: { seller: true } });

      expect(registration(response).seller?.store).toEqual({
        name: 'Studio Lila',
        slug: 'studio-lila',
        logo: null,
        categoryIds: [categories.women],
        returnAddress: null,
      });
      expect(saved.returnAddressId).toBe(saved.seller.registeredAddressId);
      expect(saved.status).toBe('DRAFT');
    });

    it('can send goods back to an address of its own', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', {
        ...store,
        returnAddress: ownReturnAddress,
      }).expect(200);
      const saved = await testApp.prisma.store.findFirstOrThrow({
        include: { seller: true, returnAddress: true },
      });

      expect(registration(response).seller?.store?.returnAddress).toEqual(ownReturnAddress);
      expect(saved.returnAddressId).not.toBe(saved.seller.registeredAddressId);
      expect(saved.returnAddress).toMatchObject({ ...ownReturnAddress, countryCode: 'CZ' });
    });

    it('saved again changes the same store and keeps one address of its own', async () => {
      const tokens = await withCompany();

      await put(tokens, 'store', { ...store, returnAddress: ownReturnAddress }).expect(200);

      const response = await put(tokens, 'store', {
        ...store,
        name: 'Lila Atelier',
        returnAddress: { ...ownReturnAddress, street: 'Vinohradská 14' },
      }).expect(200);

      expect(registration(response).seller?.store).toMatchObject({
        name: 'Lila Atelier',
        slug: 'lila-atelier',
        returnAddress: { street: 'Vinohradská 14' },
      });
      expect(await testApp.prisma.store.count()).toBe(1);
      // The registered address and the one of the store.
      expect(await testApp.prisma.address.count()).toBe(2);
    });

    it('forgets its own address when goods come back to the registered one again', async () => {
      const tokens = await withCompany();

      await put(tokens, 'store', { ...store, returnAddress: ownReturnAddress }).expect(200);

      const response = await put(tokens, 'store', store).expect(200);

      expect(registration(response).seller?.store?.returnAddress).toBeNull();
      expect(await testApp.prisma.address.count()).toBe(1);
    });

    it('keeps the subcategories it sells', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', {
        ...store,
        categoryIds: [categories.dresses, categories.hair],
      }).expect(200);

      expect(registration(response).seller?.store?.categoryIds.toSorted()).toEqual(
        [categories.dresses, categories.cosmetics].toSorted(),
      );
    });

    it('keeps a section in place of the section and its subcategories', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', {
        ...store,
        categoryIds: [categories.dresses, categories.women],
      }).expect(200);

      expect(registration(response).seller?.store?.categoryIds).toEqual([categories.women]);
    });

    it('keeps a section in place of all of its subcategories', async () => {
      const tokens = await withCompany();
      // The subcategory that is switched off does not count: hair is all that cosmetics have.
      const response = await put(tokens, 'store', {
        ...store,
        categoryIds: [categories.dresses, categories.skirts, categories.hair],
      }).expect(200);

      expect(registration(response).seller?.store?.categoryIds.toSorted()).toEqual(
        [categories.women, categories.cosmetics].toSorted(),
      );
      expect(await testApp.prisma.storeCategory.count()).toBe(2);
    });

    it('saved again sells only what was sent last', async () => {
      const tokens = await withCompany();

      await put(tokens, 'store', store).expect(200);

      const response = await put(tokens, 'store', {
        ...store,
        categoryIds: [categories.dresses],
      }).expect(200);

      expect(registration(response).seller?.store?.categoryIds).toEqual([categories.dresses]);
      expect(await testApp.prisma.storeCategory.count()).toBe(1);
    });

    it.each([
      ['a category that does not exist', (): string => '0193a7c2-0000-7000-8000-000000000009'],
      ['a subcategory that is no longer in use', (): string => categories.retired],
      ['a section that is no longer in use', (): string => categories.archive],
    ])('does not sell %s', async (_what, categoryId) => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', {
        ...store,
        categoryIds: [categories.women, categoryId()],
      }).expect(404);

      expect(response.body).toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
      expect(await testApp.prisma.store.count()).toBe(0);
    });

    it('shows the logo the person uploaded', async () => {
      const tokens = await withCompany();
      const user = await testApp.prisma.user.findUniqueOrThrow({ where: { email } });
      const image = await testApp.prisma.image.create({
        data: { uploadedById: user.id, width: 640, height: 640, copyWidths: [320, 640] },
      });
      const response = await put(tokens, 'store', { ...store, logoImageId: image.id }).expect(200);

      expect(registration(response).seller?.store?.logo).toEqual({
        imageId: image.id,
        url: expect.stringMatching(new RegExp(`/images/${image.id}/320\\.webp$`)) as string,
      });
    });

    it('does not take a photo another person uploaded for its logo', async () => {
      const tokens = await withCompany();

      await signIn(testApp, otherEmail);

      const stranger = await testApp.prisma.user.findUniqueOrThrow({
        where: { email: otherEmail },
      });
      const image = await testApp.prisma.image.create({
        data: { uploadedById: stranger.id, width: 320, height: 320, copyWidths: [320] },
      });
      const response = await put(tokens, 'store', { ...store, logoImageId: image.id }).expect(404);

      expect(response.body).toMatchObject({ code: 'IMAGE_NOT_FOUND' });
      expect(await testApp.prisma.store.count()).toBe(0);
    });

    it('cannot take a name another store has', async () => {
      const tokens = await withCompany();

      await put(tokens, 'store', store).expect(200);

      const other = await signInWithSellerAccount(testApp, otherEmail, otherPhone);

      await put(other, 'company', company(atelierNord.ico, false)).expect(200);

      // The address of a store ignores capitals and accents.
      const response = await put(other, 'store', { ...store, name: 'STUDIO Líla' }).expect(409);

      expect(response.body).toMatchObject({ code: 'STORE_NAME_TAKEN' });
      expect(await testApp.prisma.store.count()).toBe(1);
    });

    it.each([
      ['a name of one letter', { name: 'A' }],
      ['a name that is too long', { name: 'a'.repeat(121) }],
      ['a name without letters or digits', { name: '★ ♥ ★' }],
      ['no name', { name: undefined }],
      ['no word about the logo', { logoImageId: undefined }],
      ['no word about what it sells', { categoryIds: undefined }],
      ['nothing to sell', { categoryIds: [] }],
      ['a category that is not an id', { categoryIds: ['zeny'] }],
      [
        'the same category twice',
        {
          categoryIds: [
            '0193a7c2-0000-7000-8000-000000000001',
            '0193a7c2-0000-7000-8000-000000000001',
          ],
        },
      ],
      ['a logo that is not an id', { logoImageId: 'logo.png' }],
      ['no word about the return address', { returnAddress: undefined }],
      ['a return address without a street', { returnAddress: { ...ownReturnAddress, street: '' } }],
      [
        'a postal code with a space',
        { returnAddress: { ...ownReturnAddress, postalCode: '120 00' } },
      ],
      [
        'a return address in a country typed by hand',
        { returnAddress: { ...ownReturnAddress, countryCode: 'SK' } },
      ],
      ['an address of the store typed by hand', { slug: 'another-store' }],
    ])('is not saved with %s', async (_what, change) => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', { ...store, ...change }).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(await testApp.prisma.store.count()).toBe(0);
    });

    it('names the field when the name gives no address', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', { ...store, name: '★ ♥ ★' }).expect(400);

      expect(response.body).toMatchObject({ details: [{ field: 'name' }] });
    });

    it('names the field when a Czech seller gives a postal code of another country', async () => {
      const tokens = await withCompany();
      const response = await put(tokens, 'store', {
        ...store,
        returnAddress: { ...ownReturnAddress, postalCode: '31-147' },
      }).expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        details: [{ field: 'returnAddress.postalCode' }],
      });
      expect(await testApp.prisma.store.count()).toBe(0);
    });
  });

  describe('the documents', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const removeDocument = (tokens: AuthTokens, documentId: string): request.Test =>
      http()
        .delete(`/v1/seller-registration/documents/${documentId}`)
        .set(...bearer(tokens));

    it('cannot be added before the company is registered', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await addDocument(tokens, 'IDENTITY_DOCUMENT').expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_REQUIRED' });
    });

    it('are kept with the name of the file, and the type is read from the file itself', async () => {
      const tokens = await withCompany();

      await addDocument(tokens, 'IDENTITY_DOCUMENT', jpeg, 'Občanský průkaz.pdf').expect(200);

      const response = await addDocument(tokens, 'OTHER', pdf, 'C:\\scans\\licence.pdf').expect(
        200,
      );

      expect(registration(response).seller?.documents).toMatchObject([
        {
          kind: 'IDENTITY_DOCUMENT',
          fileName: 'Občanský průkaz.pdf',
          contentType: 'image/jpeg',
          sizeBytes: jpeg.length,
        },
        {
          kind: 'OTHER',
          fileName: 'licence.pdf',
          contentType: 'application/pdf',
          sizeBytes: pdf.length,
        },
      ]);
      expect(await actions()).toEqual([
        'seller.registration_started',
        'seller.document_added',
        'seller.document_added',
      ]);
    });

    it.each([
      [
        'a file that is not a PDF, a JPEG or a PNG',
        Buffer.from('<html></html>'),
        'DOCUMENT_INVALID',
      ],
      ['an empty file', Buffer.alloc(0), 'DOCUMENT_INVALID'],
    ])('are not taken as %s', async (_what, file, code) => {
      const tokens = await withCompany();
      const response = await addDocument(tokens, 'OTHER', file).expect(400);

      expect(response.body).toMatchObject({ code });
      expect(await testApp.prisma.sellerDocument.count()).toBe(0);
    });

    it('are not taken without a file, without a kind or with a kind nobody knows', async () => {
      const tokens = await withCompany();
      const form = (): request.Test =>
        http()
          .post('/v1/seller-registration/documents')
          .set(...bearer(tokens));

      expect(
        (await form().field('kind', 'OTHER').field('fileName', 'a.pdf').expect(400)).body,
      ).toMatchObject({ code: 'DOCUMENT_REQUIRED' });
      expect(
        (await form().field('fileName', 'a.pdf').attach('file', pdf, 'a.pdf').expect(400)).body,
      ).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect((await addDocument(tokens, 'PASSPORT').expect(400)).body).toMatchObject({
        code: 'VALIDATION_FAILED',
      });
      expect(await testApp.prisma.sellerDocument.count()).toBe(0);
    });

    it('can be deleted by the owner, and by nobody else', async () => {
      const tokens = await withCompany();
      const added = await addDocument(tokens, 'IDENTITY_DOCUMENT').expect(200);
      const [document] = registration(added).seller?.documents ?? [];
      const stranger = await signInWithSellerAccount(testApp, otherEmail, otherPhone);

      await put(stranger, 'company', company(atelierNord.ico, false)).expect(200);
      expect((await removeDocument(stranger, document?.id ?? '').expect(404)).body).toMatchObject({
        code: 'DOCUMENT_NOT_FOUND',
      });

      const response = await removeDocument(tokens, document?.id ?? '').expect(200);

      expect(registration(response).seller?.documents).toEqual([]);
      expect(await testApp.prisma.sellerDocument.count()).toBe(0);
      expect((await actions()).at(-1)).toBe('seller.document_removed');
    });

    it('cannot change once the registration is sent', async () => {
      const tokens = await readyToSubmit();
      const state = registration(await submit(tokens).expect(200));
      const [document] = state.seller?.documents ?? [];

      expect((await addDocument(tokens, 'OTHER').expect(409)).body).toMatchObject({
        code: 'REGISTRATION_ALREADY_SUBMITTED',
      });
      expect((await removeDocument(tokens, document?.id ?? '').expect(409)).body).toMatchObject({
        code: 'REGISTRATION_ALREADY_SUBMITTED',
      });
      expect(await testApp.prisma.sellerDocument.count()).toBe(1);
    });
  });

  describe('sending the registration', () => {
    it('needs the promise to offer only goods that comply with the law', async () => {
      const tokens = await readyToSubmit();

      for (const body of [{}, { selfCertified: false }, { selfCertified: 'yes' }]) {
        const response = await post(tokens, 'submission', body).expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      }

      expect(await testApp.prisma.seller.findFirstOrThrow()).toMatchObject({
        status: SellerStatus.DRAFT,
        selfCertifiedAt: null,
        submittedAt: null,
      });
    });

    it('needs an identity document from a Czech seller', async () => {
      const tokens = await readyToSubmit();
      const [document] = await testApp.prisma.sellerDocument.findMany();

      await http()
        .delete(`/v1/seller-registration/documents/${document?.id ?? ''}`)
        .set(...bearer(tokens))
        .expect(200);

      const response = await submit(tokens).expect(409);

      expect(response.body).toMatchObject({
        code: 'DOCUMENTS_REQUIRED',
        details: [{ field: 'documents', message: 'IDENTITY_DOCUMENT is missing' }],
      });
    });

    it('needs an identity document and an extract from the register from a seller abroad', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);

      await put(tokens, 'eu-company', atelierWisla).expect(200);
      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'bank-account', { ...bankAccount, currency: 'EUR' }).expect(200);
      await post(tokens, 'payout-check').expect(200);
      await put(tokens, 'store', store).expect(200);
      await addDocument(tokens, 'IDENTITY_DOCUMENT').expect(200);

      const response = await submit(tokens).expect(409);

      expect(response.body).toMatchObject({
        code: 'DOCUMENTS_REQUIRED',
        details: [{ message: 'REGISTER_EXTRACT is missing' }],
      });

      await addDocument(tokens, 'REGISTER_EXTRACT').expect(200);
      await submit(tokens).expect(200);
    });

    it('writes down when it was sent and when the promise was given', async () => {
      const tokens = await readyToSubmit();
      const before = Date.now();

      await submit(tokens).expect(200);

      const seller = await testApp.prisma.seller.findFirstOrThrow();

      expect(seller.submittedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(seller.selfCertifiedAt).toEqual(seller.submittedAt);
    });

    it('cannot be sent again while nobody asked for documents', async () => {
      const tokens = await readyToSubmit();

      expect((await post(tokens, 'resubmission').expect(409)).body).toMatchObject({
        code: 'DOCUMENTS_NOT_REQUESTED',
      });
      await submit(tokens).expect(200);
      expect((await post(tokens, 'resubmission').expect(409)).body).toMatchObject({
        code: 'DOCUMENTS_NOT_REQUESTED',
      });
    });

    it('needs the company', async () => {
      const tokens = await signInWithSellerAccount(testApp, email, phone);
      const response = await submit(tokens).expect(409);

      expect(response.body).toMatchObject({ code: 'COMPANY_REQUIRED' });
    });

    it('needs a finished payout form', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.BANK }).expect(200);
      await put(tokens, 'bank-account', bankAccount).expect(200);
      await put(tokens, 'store', store).expect(200);

      const response = await submit(tokens).expect(409);

      expect(response.body).toMatchObject({ code: 'REGISTRATION_INCOMPLETE' });
      expect(await testApp.prisma.seller.findFirstOrThrow()).toMatchObject({
        status: SellerStatus.DRAFT,
      });
    });

    it('needs the store', async () => {
      const tokens = await withCompany();

      await put(tokens, 'payout-method', { method: PayoutMethod.STRIPE }).expect(200);
      await post(tokens, 'payout-check').expect(200);

      const response = await submit(tokens).expect(409);

      expect(response.body).toMatchObject({ code: 'REGISTRATION_INCOMPLETE' });
    });

    it('hands the seller to Bluberi for a check while the provider still checks', async () => {
      const tokens = await readyToSubmit();
      const response = await submit(tokens).expect(200);

      expect(registration(response)).toMatchObject({
        seller: {
          status: SellerStatus.PENDING_REVIEW,
          payoutAccount: { status: PayoutAccountStatus.PENDING },
          store: { slug: 'studio-lila' },
        },
        portalOpen: true,
      });
      expect(await testApp.prisma.seller.findFirstOrThrow()).toMatchObject({
        status: SellerStatus.PENDING_REVIEW,
      });
      expect((await actions()).at(-1)).toBe('seller.registration_submitted');
    });

    it('is done once', async () => {
      const tokens = await readyToSubmit();

      await submit(tokens).expect(200);

      const response = await submit(tokens).expect(409);

      expect(response.body).toMatchObject({ code: 'REGISTRATION_ALREADY_SUBMITTED' });
      expect(
        (await actions()).filter((action) => action === 'seller.registration_submitted'),
      ).toHaveLength(1);
    });

    it.each([
      ['company', (): object => company(atelierNord.ico, false)],
      ['payout-method', (): object => ({ method: PayoutMethod.STRIPE })],
      ['bank-account', (): object => bankAccount],
      ['payout-check', undefined],
      ['store', (): object => ({ ...store, name: 'Another Name' })],
    ] as const)('closes the step %s', async (step, body) => {
      const tokens = await readyToSubmit();

      await submit(tokens).expect(200);

      const before = await state(tokens).expect(200);
      const response = await (body ? put(tokens, step, body()) : post(tokens, step)).expect(409);
      const after = await state(tokens).expect(200);

      expect(response.body).toMatchObject({ code: 'REGISTRATION_ALREADY_SUBMITTED' });
      expect(after.body).toEqual(before.body);
    });

    it('opens the portal to the staff of the seller too, and not to a stranger', async () => {
      const tokens = await readyToSubmit();
      const sent = await submit(tokens).expect(200);
      const sellerId = registration(sent).seller?.id ?? '';
      const staff = await signIn(testApp, 'staff@studiolila.cz');
      const stranger = await signIn(testApp, otherEmail);
      const staffUser = await testApp.prisma.user.findUniqueOrThrow({
        where: { email: 'staff@studiolila.cz' },
      });

      await testApp.prisma.sellerMember.create({
        data: { sellerId, userId: staffUser.id, role: SellerMemberRole.STAFF },
      });

      // The staff member did not register the seller: the registration is the owner's.
      expect((await state(staff).expect(200)).body).toMatchObject({
        seller: null,
        portalOpen: true,
      });
      expect((await state(stranger).expect(200)).body).toMatchObject({
        seller: null,
        portalOpen: false,
      });
    });
  });

  describe('the register of companies', () => {
    const lookUp = (ico: string): request.Test => http().get(`/v1/company-registry/${ico}`);

    it('needs a signed-in person', async () => {
      const response = await lookUp(studioLila.ico).expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('shows the company to anyone who is signed in', async () => {
      const tokens = await signIn(testApp, email);
      const response = await lookUp(studioLila.ico)
        .set(...bearer(tokens))
        .expect(200);

      expect(response.body).toEqual(asShown(studioLila));
    });

    it.each([
      ['a number with a wrong check digit', '27082441', 400, 'VALIDATION_FAILED'],
      ['a number the register does not know', '12345679', 404, 'COMPANY_NOT_FOUND'],
      ['a closed company', closedCompany.ico, 409, 'COMPANY_NOT_ACTIVE'],
    ])('answers with an error for %s', async (_what, ico, status, code) => {
      const tokens = await signIn(testApp, email);
      const response = await lookUp(ico)
        .set(...bearer(tokens))
        .expect(status);

      expect(response.body).toMatchObject({ code });
    });

    it('says so when the register does not answer', async () => {
      const tokens = await signIn(testApp, email);

      testApp.registry.available = false;

      const response = await lookUp(studioLila.ico)
        .set(...bearer(tokens))
        .expect(503);

      expect(response.body).toMatchObject({ code: 'COMPANY_REGISTRY_UNAVAILABLE' });
    });
  });

  describe('the register of VAT numbers', () => {
    const check = (countryCode: string, number: string): request.Test =>
      http().get(`/v1/vat-registry/${countryCode}/${number}`);

    it('needs a signed-in person', async () => {
      const response = await check('PL', '1234563218').expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('shows a valid number to anyone who is signed in', async () => {
      const tokens = await signIn(testApp, email);
      const response = await check('PL', '1234563218')
        .set(...bearer(tokens))
        .expect(200);

      expect(response.body).toEqual(atelierWislaVat);
    });

    it('shows a number without a name when its country shares none', async () => {
      const tokens = await signIn(testApp, email);
      const response = await check('ES', 'B12345674')
        .set(...bearer(tokens))
        .expect(200);

      expect(response.body).toEqual(tallerSolVat);
    });

    it.each([
      ['a country outside the EU', 'UA', '1234563218', 400, 'VALIDATION_FAILED'],
      ['a number in small letters', 'ES', 'b12345674', 400, 'VALIDATION_FAILED'],
      ['a number that is too long', 'PL', '1234563218000', 400, 'VALIDATION_FAILED'],
      ['a number the register does not know', 'PL', '9999999999', 404, 'VAT_NUMBER_NOT_FOUND'],
      ['a number of another country', 'SK', '1234563218', 404, 'VAT_NUMBER_NOT_FOUND'],
    ])('answers with an error for %s', async (_what, countryCode, number, status, code) => {
      const tokens = await signIn(testApp, email);
      const response = await check(countryCode, number)
        .set(...bearer(tokens))
        .expect(status);

      expect(response.body).toMatchObject({ code });
    });

    it('says so when the register does not answer', async () => {
      const tokens = await signIn(testApp, email);

      testApp.vatRegistry.available = false;

      const response = await check('PL', '1234563218')
        .set(...bearer(tokens))
        .expect(503);

      expect(response.body).toMatchObject({ code: 'VAT_REGISTRY_UNAVAILABLE' });
    });
  });
});
