import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthTokens } from '../src/auth/auth.dto.js';
import type { RegistryCompany, RegistryTrade } from '../src/company-registry/company-registry.js';
import {
  PlatformRole,
  SellerLegalForm,
  SellerStatus,
  StoreStatus,
} from '../src/generated/prisma/enums.js';
import type {
  ModeratedSeller,
  ModeratedSellersPage,
  SellerRegisterCheck,
} from '../src/seller-moderation/seller-moderation.dto.js';
import type { SellerRegistration } from '../src/seller-registration/seller-registration.dto.js';
import { bearer, signIn, signInTeamMember, signInWithSellerAccount } from './support/actors.js';
import { createCategories, type TestCategories } from './support/catalog.js';
import { pdf, prepareSeller, registerSeller, studioLila } from './support/sellers.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const ownerOfStudioLila = { email: 'jana@studiolila.cz', phone: '+420777123456' };
const ownerOfAtelierNord = { email: 'petr@ateliernord.cz', phone: '+420602111222' };
const atelierNord: RegistryCompany = {
  ico: '25596641',
  legalName: 'Petr Nord',
  legalForm: SellerLegalForm.SOLE_TRADER,
  vatNumber: null,
  isVatPayer: false,
  isActive: true,
  address: { street: 'Rožkovo údolí 2865', city: 'Mělník', postalCode: '27601', countryCode: 'CZ' },
};
const retailTrade: RegistryTrade = {
  name: 'Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona',
  kind: 'FREE',
  since: '2003-08-26',
  fields: ['Velkoobchod a maloobchod'],
};
const unknownSeller = '0193a7c2-0000-7000-8000-000000000001';
const request_ = 'Pošlete prosím výpis z obchodního rejstříku, ne starší než tři měsíce.';
const reason = 'Firma podle rejstříku zanikla, takže na Bluberi prodávat nemůže.';

describe('Seller moderation', () => {
  let testApp: TestApp;
  let categories: TestCategories;
  let moderator: AuthTokens;

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());
  const admin = (tokens: AuthTokens, path = ''): request.Test =>
    http()
      .get(`/v1/admin/sellers${path}`)
      .set(...bearer(tokens));
  const decide = (
    tokens: AuthTokens,
    sellerId: string,
    decision: string,
    body: object = {},
  ): request.Test =>
    http()
      .post(`/v1/admin/sellers/${sellerId}/${decision}`)
      .set(...bearer(tokens))
      .send(body);
  const remove = (tokens: AuthTokens, sellerId: string): request.Test =>
    http()
      .delete(`/v1/admin/sellers/${sellerId}`)
      .set(...bearer(tokens));
  const card = (response: request.Response): ModeratedSeller => response.body as ModeratedSeller;
  const registrationOf = async (tokens: AuthTokens): Promise<SellerRegistration> =>
    (
      await http()
        .get('/v1/seller-registration')
        .set(...bearer(tokens))
        .expect(200)
    ).body as SellerRegistration;
  const lastEmailTo = (email: string): { subject: string; text: string } | undefined =>
    testApp.mail.sent.filter(({ to }) => to === email).at(-1);
  const actions = async (): Promise<string[]> => {
    const entries = await testApp.prisma.auditLogEntry.findMany({
      where: { action: { startsWith: 'seller.' } },
      orderBy: { id: 'asc' },
    });

    return entries.map(({ action }) => action);
  };

  /** Studio Lila, sent to Bluberi and waiting for the check. */
  const waitingSeller = (): ReturnType<typeof registerSeller> =>
    registerSeller(testApp, {
      ...ownerOfStudioLila,
      company: studioLila,
      storeName: 'Studio Lila',
      categoryIds: [categories.dresses, categories.cosmetics],
    });
  /** Atelier Nord, registered up to the last step and not sent. */
  const draftSeller = (): ReturnType<typeof prepareSeller> =>
    prepareSeller(testApp, {
      ...ownerOfAtelierNord,
      company: atelierNord,
      storeName: 'Atelier Nord',
      categoryIds: [categories.dresses],
    });

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
    categories = await createCategories(testApp);
    moderator = await signInTeamMember(testApp, 'maria@bluberi.cz', [PlatformRole.MODERATOR]);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('access', () => {
    const reading = [
      ['the list', '?status=PENDING_REVIEW'],
      ['the counts', '/counts'],
      ['the card', '/{id}'],
      ['the check against the registers', '/{id}/register-check'],
      ['a document', '/{id}/documents/{document}'],
    ] as const;
    const decisions = [
      ['approval', {}],
      ['document-request', { message: request_ }],
      ['rejection', { message: reason }],
      ['reopening', {}],
    ] as const;

    /** The address of a reading route for one seller and its first document. */
    async function pathOf(template: string, sellerId: string): Promise<string> {
      const document = await testApp.prisma.sellerDocument.findFirstOrThrow({
        where: { sellerId },
      });

      return template.replace('{id}', sellerId).replace('{document}', document.id);
    }

    it('needs a signed-in person everywhere', async () => {
      const { sellerId } = await waitingSeller();

      for (const [, template] of reading) {
        const path = await pathOf(template, sellerId);
        const response = await http().get(`/v1/admin/sellers${path}`).expect(401);

        expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
      }

      for (const [decision, body] of decisions) {
        await http().post(`/v1/admin/sellers/${sellerId}/${decision}`).send(body).expect(401);
      }

      await http().delete(`/v1/admin/sellers/${sellerId}`).expect(401);
    });

    it('is closed to a buyer and to the seller', async () => {
      const { sellerId, tokens: seller } = await waitingSeller();
      const buyer = await signIn(testApp, 'buyer@example.cz');

      for (const tokens of [buyer, seller]) {
        for (const [, template] of reading) {
          const response = await admin(tokens, await pathOf(template, sellerId)).expect(403);

          expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
        }

        for (const [decision, body] of decisions) {
          await decide(tokens, sellerId, decision, body).expect(403);
        }

        await remove(tokens, sellerId).expect(403);
      }

      expect(
        await testApp.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } }),
      ).toMatchObject({ status: SellerStatus.PENDING_REVIEW });
    });

    it.each([PlatformRole.LOGISTICS])('is closed to the team role %s', async (role) => {
      const { sellerId } = await waitingSeller();
      const member = await signInTeamMember(testApp, 'member@bluberi.cz', [role]);

      for (const [, template] of reading) {
        await admin(member, await pathOf(template, sellerId)).expect(403);
      }

      for (const [decision, body] of decisions) {
        await decide(member, sellerId, decision, body).expect(403);
      }

      await remove(member, sellerId).expect(403);
    });

    it.each([PlatformRole.SUPPORT, PlatformRole.FINANCE])(
      'lets the team role %s read and decide nothing',
      async (role) => {
        const { sellerId } = await waitingSeller();
        const member = await signInTeamMember(testApp, 'member@bluberi.cz', [role]);

        for (const [, template] of reading) {
          await admin(member, await pathOf(template, sellerId)).expect(200);
        }

        for (const [decision, body] of decisions) {
          const response = await decide(member, sellerId, decision, body).expect(403);

          expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
        }

        await remove(member, sellerId).expect(403);
        expect(
          await testApp.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } }),
        ).toMatchObject({ status: SellerStatus.PENDING_REVIEW });
      },
    );

    it.each([PlatformRole.OWNER, PlatformRole.MODERATOR])(
      'lets the team role %s read and decide',
      async (role) => {
        const { sellerId } = await waitingSeller();
        const { sellerId: draftId } = await draftSeller();
        const member = await signInTeamMember(testApp, 'member@bluberi.cz', [role]);

        for (const [, template] of reading) {
          await admin(member, await pathOf(template, sellerId)).expect(200);
        }

        await decide(member, sellerId, 'document-request', { message: request_ }).expect(200);
        await decide(member, sellerId, 'rejection', { message: reason }).expect(200);
        await decide(member, sellerId, 'reopening').expect(200);
        await decide(member, sellerId, 'approval').expect(200);
        await remove(member, draftId).expect(204);
      },
    );
  });

  describe('the list', () => {
    it('shows the sellers of one status with what the team sees at a glance', async () => {
      const { sellerId } = await waitingSeller();

      await draftSeller();

      const response = await admin(moderator, '?status=PENDING_REVIEW').expect(200);
      const seller = await testApp.prisma.seller.findUniqueOrThrow({ where: { id: sellerId } });

      expect(response.body).toEqual({
        items: [
          {
            id: sellerId,
            legalName: 'Studio Lila s.r.o.',
            countryCode: 'CZ',
            registrationNumber: '27082440',
            status: SellerStatus.PENDING_REVIEW,
            companyCheck: 'COMPANY_REGISTER',
            createdAt: seller.createdAt.toISOString(),
            submittedAt: seller.submittedAt?.toISOString(),
            storeName: 'Studio Lila',
            logoUrl: null,
            categories: [
              { section: 'Kosmetika', subcategories: [] },
              { section: 'Ženy', subcategories: ['Šaty'] },
            ],
            documentsCount: 1,
            unreadConversations: 0,
            payoutStatus: 'PENDING',
          },
        ],
        nextCursor: null,
      });
    });

    it('counts the sellers of every status', async () => {
      await waitingSeller();
      await draftSeller();

      const response = await admin(moderator, '/counts').expect(200);

      expect(response.body).toEqual({
        DRAFT: 1,
        PENDING_REVIEW: 1,
        DOCUMENTS_REQUESTED: 0,
        APPROVED: 0,
        REJECTED: 0,
        SUSPENDED: 0,
      });
    });

    it('puts the seller who waits longest first and reads on page by page', async () => {
      const first = await waitingSeller();
      const second = await registerSeller(testApp, {
        ...ownerOfAtelierNord,
        company: atelierNord,
        storeName: 'Atelier Nord',
        categoryIds: [categories.dresses],
      });

      // The first seller answers a request for documents, so its registration is sent again and waits least.
      await decide(moderator, first.sellerId, 'document-request', { message: request_ }).expect(
        200,
      );
      await http()
        .post('/v1/seller-registration/resubmission')
        .set(...bearer(first.tokens))
        .expect(200);

      const firstPage = (await admin(moderator, '?status=PENDING_REVIEW&limit=1').expect(200))
        .body as ModeratedSellersPage;

      expect(firstPage.items.map(({ id }) => id)).toEqual([second.sellerId]);
      expect(firstPage.nextCursor).toBe(second.sellerId);

      const secondPage = (
        await admin(
          moderator,
          `?status=PENDING_REVIEW&limit=1&cursor=${firstPage.nextCursor ?? ''}`,
        ).expect(200)
      ).body as ModeratedSellersPage;

      expect(secondPage.items.map(({ id }) => id)).toEqual([first.sellerId]);
      expect(secondPage.nextCursor).toBeNull();
    });

    it.each([
      ['no status', ''],
      ['a status nobody knows', '?status=WAITING'],
      ['a page of no size', '?status=DRAFT&limit=0'],
      ['a cursor that is not an id', '?status=DRAFT&cursor=first'],
    ])('is refused with %s', async (_what, query) => {
      const response = await admin(moderator, query).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('the card', () => {
    it('shows everything the team decides by', async () => {
      const { sellerId } = await waitingSeller();
      const response = await admin(moderator, `/${sellerId}`).expect(200);

      expect(card(response)).toMatchObject({
        id: sellerId,
        status: SellerStatus.PENDING_REVIEW,
        reviewMessage: null,
        reviewedAt: null,
        reviewedByEmail: null,
        company: {
          countryCode: 'CZ',
          registrationNumber: '27082440',
          legalName: 'Studio Lila s.r.o.',
          legalForm: SellerLegalForm.COMPANY,
          vatNumber: 'CZ27082440',
          isVatPayer: true,
          check: 'COMPANY_REGISTER',
          address: studioLila.address,
        },
        contactEmail: ownerOfStudioLila.email,
        contactPhone: ownerOfStudioLila.phone,
        payoutAccount: {
          method: 'BANK',
          status: 'PENDING',
          bankAccount: { country: 'CZ', last4: '5399', currency: 'CZK' },
        },
        store: {
          name: 'Studio Lila',
          slug: 'studio-lila',
          logoUrl: null,
          categories: [
            { section: 'Kosmetika', subcategories: [] },
            { section: 'Ženy', subcategories: ['Šaty'] },
          ],
          returnAddress: studioLila.address,
        },
        documents: [
          {
            kind: 'IDENTITY_DOCUMENT',
            fileName: 'Občanský průkaz.pdf',
            contentType: 'application/pdf',
          },
        ],
        requiredDocuments: ['IDENTITY_DOCUMENT'],
        traceability: {
          contacts: true,
          address: true,
          identityDocument: true,
          paymentAccount: true,
          registrationNumber: true,
          selfCertification: true,
        },
      });
      expect(card(response).submittedAt).toEqual(card(response).selfCertifiedAt);
      expect(card(response).history.map(({ action, actorEmail }) => [action, actorEmail])).toEqual([
        ['seller.registration_submitted', ownerOfStudioLila.email],
        ['seller.document_added', ownerOfStudioLila.email],
        ['seller.bank_account_saved', ownerOfStudioLila.email],
        ['seller.payout_method_chosen', ownerOfStudioLila.email],
        ['seller.registration_started', ownerOfStudioLila.email],
      ]);
    });

    it('says what a draft still lacks', async () => {
      const { sellerId, tokens } = await draftSeller();
      const [document] = await testApp.prisma.sellerDocument.findMany({ where: { sellerId } });

      await http()
        .delete(`/v1/seller-registration/documents/${document?.id ?? ''}`)
        .set(...bearer(tokens))
        .expect(200);

      const response = await admin(moderator, `/${sellerId}`).expect(200);

      expect(card(response)).toMatchObject({
        status: SellerStatus.DRAFT,
        submittedAt: null,
        selfCertifiedAt: null,
        documents: [],
        traceability: { identityDocument: false, selfCertification: false, paymentAccount: true },
      });
    });

    it('is not there for an id nobody has', async () => {
      const response = await admin(moderator, `/${unknownSeller}`).expect(404);

      expect(response.body).toMatchObject({ code: 'SELLER_NOT_FOUND' });
      await admin(moderator, '/not-an-id').expect(400);
    });
  });

  describe('the check against the registers', () => {
    const check = async (sellerId: string): Promise<SellerRegisterCheck> =>
      (await admin(moderator, `/${sellerId}/register-check`).expect(200))
        .body as SellerRegisterCheck;

    it('says a Czech company matches its record and lists its trade licences', async () => {
      const { sellerId } = await waitingSeller();

      testApp.registry.licences.set(studioLila.ico, [retailTrade]);

      expect(await check(sellerId)).toEqual({
        result: 'MATCHES',
        differences: [],
        registerName: 'Studio Lila s.r.o.',
        registerAddress: 'Korunní 2569/108, 10100 Praha 10',
        trades: [retailTrade],
        retailTrade: true,
      });
    });

    it('has no licences for a company the trade register does not list', async () => {
      const { sellerId } = await waitingSeller();

      expect(await check(sellerId)).toMatchObject({
        result: 'MATCHES',
        trades: null,
        retailTrade: null,
      });
    });

    it('says a company may not sell goods when its licences are for something else', async () => {
      const { sellerId } = await waitingSeller();

      testApp.registry.licences.set(studioLila.ico, [
        { name: 'Hostinská činnost', kind: 'CRAFT', since: '2014-10-29', fields: [] },
      ]);

      expect(await check(sellerId)).toMatchObject({ retailTrade: false });
    });

    it('asks the registers once for a card that is read again, and anew when the seller changes', async () => {
      const { sellerId } = await waitingSeller();

      expect(await check(sellerId)).toMatchObject({ result: 'MATCHES' });

      testApp.registry.companies.set(studioLila.ico, {
        ...studioLila,
        legalName: 'Studio Lila v likvidaci s.r.o.',
      });

      // An open card reads itself again with every change in the admin: the register is not asked each time.
      expect(await check(sellerId)).toMatchObject({ result: 'MATCHES' });

      await decide(moderator, sellerId, 'document-request', { message: request_ }).expect(200);

      expect(await check(sellerId)).toMatchObject({
        result: 'DIFFERS',
        differences: ['legalName'],
      });
    });

    it('asks again after a register did not answer', async () => {
      const { sellerId } = await waitingSeller();

      testApp.registry.available = false;
      expect(await check(sellerId)).toMatchObject({ result: 'UNAVAILABLE' });

      testApp.registry.available = true;
      expect(await check(sellerId)).toMatchObject({ result: 'MATCHES' });
    });

    it('names what changed in the register since the registration', async () => {
      const { sellerId } = await waitingSeller();

      testApp.registry.companies.set(studioLila.ico, {
        ...studioLila,
        legalName: 'Studio Lila v likvidaci s.r.o.',
        vatNumber: null,
        isActive: false,
        address: { ...studioLila.address, street: 'Vinohradská 12' },
      });

      expect(await check(sellerId)).toMatchObject({
        result: 'DIFFERS',
        differences: ['legalName', 'vatNumber', 'address', 'closed'],
        registerName: 'Studio Lila v likvidaci s.r.o.',
      });
    });

    it('says so when the register has no such company any more', async () => {
      const { sellerId } = await waitingSeller();

      testApp.registry.companies.clear();

      expect(await check(sellerId)).toEqual({
        result: 'NOT_FOUND',
        differences: [],
        registerName: null,
        registerAddress: null,
        trades: null,
        retailTrade: null,
      });
    });

    it('says so when the register does not answer', async () => {
      const { sellerId } = await waitingSeller();

      testApp.registry.available = false;

      expect(await check(sellerId)).toMatchObject({ result: 'UNAVAILABLE', trades: null });
    });

    describe('of a company from another EU country', () => {
      const polishCompany = {
        countryCode: 'PL',
        vatNumber: '1234563218',
        registrationNumber: '0000123456',
        legalName: 'Atelier Wisła sp. z o.o.',
        legalForm: SellerLegalForm.COMPANY,
        address: { street: 'ul. Piękna 12', city: 'Warszawa', postalCode: '00-549' },
        termsAccepted: true,
      };

      /** A draft of a Polish company. The register of VAT numbers answers what the test put into it. */
      async function polishSeller(company: object = polishCompany): Promise<string> {
        const tokens = await signInWithSellerAccount(
          testApp,
          ownerOfAtelierNord.email,
          ownerOfAtelierNord.phone,
        );
        const response = await http()
          .put('/v1/seller-registration/eu-company')
          .set(...bearer(tokens))
          .send(company)
          .expect(200);

        return (response.body as SellerRegistration).seller?.id ?? '';
      }

      beforeEach(() => {
        testApp.vatRegistry.records.set('PL1234563218', {
          vatNumber: 'PL1234563218',
          name: 'ATELIER WISŁA SP. Z O.O.',
          address: 'UL. PIĘKNA 12, 00-549 WARSZAWA',
        });
      });

      it('says the VAT number is valid and whose it is', async () => {
        expect(await check(await polishSeller())).toEqual({
          result: 'MATCHES',
          differences: [],
          registerName: 'ATELIER WISŁA SP. Z O.O.',
          registerAddress: 'UL. PIĘKNA 12, 00-549 WARSZAWA',
          trades: null,
          retailTrade: null,
        });
      });

      it('names the name when the register has another one now', async () => {
        const sellerId = await polishSeller();

        testApp.vatRegistry.records.set('PL1234563218', {
          vatNumber: 'PL1234563218',
          name: 'INNA FIRMA SP. Z O.O.',
          address: null,
        });

        expect(await check(sellerId)).toMatchObject({
          result: 'DIFFERS',
          differences: ['legalName'],
          registerName: 'INNA FIRMA SP. Z O.O.',
        });
      });

      it('says so when the number is not valid any more', async () => {
        const sellerId = await polishSeller();

        testApp.vatRegistry.records.clear();

        expect(await check(sellerId)).toMatchObject({ result: 'NOT_FOUND' });
      });

      it('says so when the register does not answer', async () => {
        const sellerId = await polishSeller();

        testApp.vatRegistry.available = false;

        expect(await check(sellerId)).toMatchObject({ result: 'UNAVAILABLE' });
      });

      it('asks no register about a trader without a VAT number', async () => {
        const sellerId = await polishSeller({ ...polishCompany, vatNumber: null });

        testApp.vatRegistry.available = false;

        expect(await check(sellerId)).toMatchObject({ result: 'NOT_CHECKED' });
      });
    });
  });

  describe('a document', () => {
    it('is opened as the file the seller uploaded, and the opening is written down', async () => {
      const { sellerId } = await waitingSeller();
      const document = await testApp.prisma.sellerDocument.findFirstOrThrow({
        where: { sellerId },
      });
      const response = await admin(moderator, `/${sellerId}/documents/${document.id}`)
        .buffer(true)
        .parse((incoming, done) => {
          const chunks: Buffer[] = [];

          incoming.on('data', (chunk: Buffer) => chunks.push(chunk));
          incoming.on('end', () => {
            done(null, Buffer.concat(chunks));
          });
        })
        .expect(200);
      const [entry] = await testApp.prisma.auditLogEntry.findMany({
        where: { action: 'seller.document_opened' },
        include: { actor: true },
      });

      expect(response.body).toEqual(pdf);
      expect(response.headers).toMatchObject({
        'content-type': 'application/pdf',
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      });
      expect(response.headers['content-disposition']).toContain('inline');
      expect(entry).toMatchObject({
        targetId: sellerId,
        actor: { email: 'maria@bluberi.cz' },
        details: { documentId: document.id, kind: 'IDENTITY_DOCUMENT' },
      });
    });

    it('is not opened under another seller', async () => {
      const { sellerId } = await waitingSeller();
      const { sellerId: otherId } = await draftSeller();
      const document = await testApp.prisma.sellerDocument.findFirstOrThrow({
        where: { sellerId },
      });
      const response = await admin(moderator, `/${otherId}/documents/${document.id}`).expect(404);

      expect(response.body).toMatchObject({ code: 'DOCUMENT_NOT_FOUND' });
    });
  });

  describe('an approval', () => {
    it('lets the seller sell, opens the store and tells the seller by email', async () => {
      const { sellerId, tokens } = await waitingSeller();
      const before = Date.now();
      const response = await decide(moderator, sellerId, 'approval').expect(200);

      expect(card(response)).toMatchObject({
        status: SellerStatus.APPROVED,
        reviewMessage: null,
        reviewedByEmail: 'maria@bluberi.cz',
      });
      expect(new Date(card(response).reviewedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
      expect(await testApp.prisma.store.findFirstOrThrow()).toMatchObject({
        status: StoreStatus.ACTIVE,
      });
      expect(lastEmailTo(ownerOfStudioLila.email)).toMatchObject({
        subject: 'Bluberi: váš obchod je schválený',
      });
      expect(lastEmailTo(ownerOfStudioLila.email)?.text).toContain('Studio Lila s.r.o.');
      expect((await actions()).at(-1)).toBe('seller.approved');
      expect(await registrationOf(tokens)).toMatchObject({
        seller: { status: SellerStatus.APPROVED },
        portalOpen: true,
      });
    });

    it('is written in the language of the owner', async () => {
      const { sellerId } = await waitingSeller();

      await testApp.prisma.user.update({
        where: { email: ownerOfStudioLila.email },
        data: { locale: 'en' },
      });
      await decide(moderator, sellerId, 'approval').expect(200);

      expect(lastEmailTo(ownerOfStudioLila.email)).toMatchObject({
        subject: 'Bluberi: your store is approved',
      });
    });

    it('is given once, and only to a seller in the check', async () => {
      const { sellerId } = await waitingSeller();
      const { sellerId: draftId } = await draftSeller();

      await decide(moderator, sellerId, 'approval').expect(200);

      for (const id of [sellerId, draftId]) {
        const response = await decide(moderator, id, 'approval').expect(409);

        expect(response.body).toMatchObject({ code: 'SELLER_STATUS_CONFLICT' });
      }

      expect((await actions()).filter((action) => action === 'seller.approved')).toHaveLength(1);
      expect((await decide(moderator, unknownSeller, 'approval').expect(404)).body).toMatchObject({
        code: 'SELLER_NOT_FOUND',
      });
    });
  });

  describe('a request for documents', () => {
    it('tells the seller what to send, in the portal and by email', async () => {
      const { sellerId, tokens } = await waitingSeller();
      const response = await decide(moderator, sellerId, 'document-request', {
        message: `  ${request_}  `,
      }).expect(200);

      expect(card(response)).toMatchObject({
        status: SellerStatus.DOCUMENTS_REQUESTED,
        reviewMessage: request_,
        reviewedByEmail: 'maria@bluberi.cz',
      });
      expect(card(response).history[0]).toMatchObject({
        action: 'seller.documents_requested',
        actorEmail: 'maria@bluberi.cz',
        message: request_,
      });
      expect(lastEmailTo(ownerOfStudioLila.email)?.subject).toBe(
        'Bluberi: k registraci potřebujeme doplnit doklady',
      );
      expect(lastEmailTo(ownerOfStudioLila.email)?.text).toContain(request_);
      expect(await registrationOf(tokens)).toMatchObject({
        seller: { status: SellerStatus.DOCUMENTS_REQUESTED, reviewMessage: request_ },
        portalOpen: true,
      });
    });

    it('is answered with documents, and the registration goes back into the check', async () => {
      const { sellerId, tokens } = await waitingSeller();

      await decide(moderator, sellerId, 'document-request', { message: request_ }).expect(200);

      const added = await http()
        .post('/v1/seller-registration/documents')
        .set(...bearer(tokens))
        .field('kind', 'REGISTER_EXTRACT')
        .field('fileName', 'Výpis.pdf')
        .attach('file', pdf, 'upload.bin')
        .expect(200);

      expect((added.body as SellerRegistration).seller?.documents).toHaveLength(2);

      // Only the documents change: the company and the store are what the team already looked at.
      const company = await http()
        .put('/v1/seller-registration/company')
        .set(...bearer(tokens))
        .send({ ico: studioLila.ico, isVatPayer: false, termsAccepted: true })
        .expect(409);

      expect(company.body).toMatchObject({ code: 'REGISTRATION_ALREADY_SUBMITTED' });

      const sent = await http()
        .post('/v1/seller-registration/resubmission')
        .set(...bearer(tokens))
        .expect(200);

      expect((sent.body as SellerRegistration).seller).toMatchObject({
        status: SellerStatus.PENDING_REVIEW,
        reviewMessage: request_,
      });
      expect((await actions()).slice(-3)).toEqual([
        'seller.documents_requested',
        'seller.document_added',
        'seller.registration_submitted',
      ]);
      await decide(moderator, sellerId, 'approval').expect(200);
    });

    it.each([
      ['no message', {}],
      ['a message of a few letters', { message: 'Hm' }],
      ['a message that is too long', { message: 'a'.repeat(2001) }],
      ['a field nobody knows', { message: request_, deadline: 'tomorrow' }],
    ])('is not made with %s', async (_what, body) => {
      const { sellerId } = await waitingSeller();
      const response = await decide(moderator, sellerId, 'document-request', body).expect(400);

      expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(testApp.mail.sent.filter(({ to }) => to === ownerOfStudioLila.email)).toHaveLength(1);
    });

    it('is made only for a seller in the check', async () => {
      const { sellerId } = await waitingSeller();
      const { sellerId: draftId } = await draftSeller();

      await decide(moderator, sellerId, 'document-request', { message: request_ }).expect(200);

      for (const id of [sellerId, draftId]) {
        const response = await decide(moderator, id, 'document-request', {
          message: request_,
        }).expect(409);

        expect(response.body).toMatchObject({ code: 'SELLER_STATUS_CONFLICT' });
      }
    });
  });

  describe('a refusal', () => {
    it('closes the portal to the seller and says why, in the portal and by email', async () => {
      const { sellerId, tokens } = await waitingSeller();
      const response = await decide(moderator, sellerId, 'rejection', { message: reason }).expect(
        200,
      );

      expect(card(response)).toMatchObject({
        status: SellerStatus.REJECTED,
        reviewMessage: reason,
      });
      expect(lastEmailTo(ownerOfStudioLila.email)?.subject).toBe(
        'Bluberi: registraci prodejce jsme neschválili',
      );
      expect(lastEmailTo(ownerOfStudioLila.email)?.text).toContain(reason);
      expect(lastEmailTo(ownerOfStudioLila.email)?.text).toContain('support@bluberi.cz');
      expect(await registrationOf(tokens)).toMatchObject({
        seller: { status: SellerStatus.REJECTED, reviewMessage: reason },
        portalOpen: false,
      });
      expect(await testApp.prisma.store.findFirstOrThrow()).toMatchObject({
        status: StoreStatus.DRAFT,
      });
      expect((await actions()).at(-1)).toBe('seller.rejected');
    });

    it('can follow a request for documents nobody answered', async () => {
      const { sellerId } = await waitingSeller();

      await decide(moderator, sellerId, 'document-request', { message: request_ }).expect(200);
      await decide(moderator, sellerId, 'rejection', { message: reason }).expect(200);
    });

    it('needs a reason, and a seller that was not approved or refused yet', async () => {
      const { sellerId } = await waitingSeller();

      expect((await decide(moderator, sellerId, 'rejection').expect(400)).body).toMatchObject({
        code: 'VALIDATION_FAILED',
      });
      await decide(moderator, sellerId, 'approval').expect(200);
      expect(
        (await decide(moderator, sellerId, 'rejection', { message: reason }).expect(409)).body,
      ).toMatchObject({ code: 'SELLER_STATUS_CONFLICT' });
    });

    it('can be taken back: the seller returns into the check', async () => {
      const { sellerId, tokens } = await waitingSeller();

      expect((await decide(moderator, sellerId, 'reopening').expect(409)).body).toMatchObject({
        code: 'SELLER_STATUS_CONFLICT',
      });
      await decide(moderator, sellerId, 'rejection', { message: reason }).expect(200);

      const response = await decide(moderator, sellerId, 'reopening').expect(200);

      expect(card(response)).toMatchObject({ status: SellerStatus.PENDING_REVIEW });
      expect(card(response).history[0]).toMatchObject({ action: 'seller.review_reopened' });
      expect(await registrationOf(tokens)).toMatchObject({ portalOpen: true });
    });
  });

  describe('deleting a registration nobody sent', () => {
    it('removes everything of it and frees the company number', async () => {
      const { sellerId, tokens } = await draftSeller();
      const before = await testApp.prisma.address.count();

      await remove(moderator, sellerId).expect(204);

      expect(await testApp.prisma.seller.count()).toBe(0);
      expect(await testApp.prisma.store.count()).toBe(0);
      expect(await testApp.prisma.storeCategory.count()).toBe(0);
      expect(await testApp.prisma.sellerDocument.count()).toBe(0);
      expect(await testApp.prisma.sellerPayoutAccount.count()).toBe(0);
      expect(await testApp.prisma.address.count()).toBe(before - 1);
      expect(testApp.payouts.closed).toEqual(['acct_test_1']);
      expect(
        await testApp.prisma.auditLogEntry.findFirstOrThrow({
          where: { action: 'seller.draft_removed' },
        }),
      ).toMatchObject({
        targetId: sellerId,
        details: { countryCode: 'CZ', registrationNumber: '25596641', legalName: 'Petr Nord' },
      });
      // The person starts again, and the company can be registered again.
      expect(await registrationOf(tokens)).toMatchObject({ seller: null, portalOpen: false });
      await http()
        .put('/v1/seller-registration/company')
        .set(...bearer(tokens))
        .send({ ico: atelierNord.ico, isVatPayer: false, termsAccepted: true })
        .expect(200);
    });

    it('leaves a registration that was sent', async () => {
      const { sellerId } = await waitingSeller();
      const response = await remove(moderator, sellerId).expect(409);

      expect(response.body).toMatchObject({ code: 'SELLER_NOT_DRAFT' });
      expect(await testApp.prisma.seller.count()).toBe(1);
      expect(await testApp.prisma.sellerDocument.count()).toBe(1);
      expect(testApp.payouts.closed).toEqual([]);
    });

    it('answers that there is nothing to delete for an id nobody has', async () => {
      const response = await remove(moderator, unknownSeller).expect(404);

      expect(response.body).toMatchObject({ code: 'SELLER_NOT_FOUND' });
    });
  });
});
