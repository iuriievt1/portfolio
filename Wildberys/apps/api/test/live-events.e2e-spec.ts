import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthTokens } from '../src/auth/auth.dto.js';
import {
  PayoutAccountStatus,
  PlatformRole,
  SellerMemberRole,
} from '../src/generated/prisma/enums.js';
import type { ConversationsPage } from '../src/seller-messages/seller-messages.dto.js';
import { bearer, signIn, signInTeamMember } from './support/actors.js';
import { createCategories, type TestCategories } from './support/catalog.js';
import { liveEventsHeard, openStream, type OpenStream } from './support/event-stream.js';
import { pdf, prepareSeller, registerSeller, studioLila } from './support/sellers.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const owner = { email: 'jana@studiolila.cz', phone: '+420777123456' };
const subject = 'Dotaz ke kategoriím';
const question = 'Dobrý den, prodáváte i dětské oblečení?';
const answer = 'Dobrý den, ano, od 2 do 10 let.';
const ofTeam = '/v1/admin/events';

describe('Live events', () => {
  let testApp: TestApp;
  let categories: TestCategories;
  let moderator: AuthTokens;
  let seller: AuthTokens;
  let sellerId: string;

  /** The streams a test holds open. They are closed after it, or the application could not stop. */
  const streams: OpenStream[] = [];

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());
  const ofSeller = (id = sellerId): string => `/v1/sellers/${id}/events`;
  const get = (tokens: AuthTokens, path: string): request.Test =>
    http()
      .get(path)
      .set(...bearer(tokens));
  const post = (tokens: AuthTokens, path: string, body: object = {}): request.Test =>
    http()
      .post(path)
      .set(...bearer(tokens))
      .send(body);
  const idOf = (response: request.Response): string => (response.body as { id: string }).id;
  const decide = (decision: string, body: object = {}, id = sellerId): request.Test =>
    post(moderator, `/v1/admin/sellers/${id}/${decision}`, body);
  /** A conversation the team opened with the seller. */
  const fromTeam = async (id = sellerId): Promise<string> =>
    idOf(
      await post(moderator, `/v1/admin/sellers/${id}/conversations`, {
        subject,
        body: question,
      }).expect(201),
    );
  const fromSeller = async (): Promise<string> =>
    idOf(
      await post(seller, `/v1/sellers/${sellerId}/conversations`, {
        subject,
        body: answer,
      }).expect(201),
    );

  /** Opens the stream a page listens to, and waits until the page is heard. */
  async function listen(tokens: AuthTokens, path: string): Promise<OpenStream> {
    const stream = await openStream(testApp, path, tokens);

    streams.push(stream);
    expect(stream.status).toBe(200);
    expect(await stream.next()).toEqual({ type: 'ready', data: {} });

    return stream;
  }

  const conversationChanged = (conversationId: string, id = sellerId): object => ({
    type: 'change',
    data: { kind: 'conversation-changed', sellerId: id, conversationId },
  });
  const sellerChanged = (id = sellerId): object => ({
    type: 'change',
    data: { kind: 'seller-changed', sellerId: id },
  });
  const newsletterChanged = { type: 'change', data: { kind: 'newsletter-changed' } };

  /** Another seller that has done every step of the registration and sent nothing yet. */
  const otherSeller = (): ReturnType<typeof prepareSeller> =>
    prepareSeller(testApp, {
      email: 'petr@ateliernord.cz',
      phone: '+420777654321',
      company: { ...studioLila, ico: '45274649', legalName: 'Atelier Nord s.r.o.' },
      storeName: 'Atelier Nord',
      categoryIds: [categories.dresses],
    });

  const send = (tokens: AuthTokens, path: 'submission' | 'resubmission'): request.Test =>
    post(tokens, `/v1/seller-registration/${path}`, { selfCertified: true });

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.prisma);
    testApp.mail.sent.length = 0;
    testApp.sms.sent.length = 0;
    testApp.registry.reset();
    testApp.payouts.reset();
    categories = await createCategories(testApp);
    moderator = await signInTeamMember(testApp, 'maria@bluberi.cz', [PlatformRole.MODERATOR]);
    ({ tokens: seller, sellerId } = await registerSeller(testApp, {
      ...owner,
      company: studioLila,
      storeName: 'Studio Lila',
      categoryIds: [categories.women],
    }));
    // What the registration reported is heard before a test opens a stream.
    await liveEventsHeard(testApp);
  });

  afterEach(() => {
    for (const stream of streams.splice(0)) {
      stream.close();
    }
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('access', () => {
    it('needs a signed-in person', async () => {
      for (const path of [ofSeller(), ofTeam]) {
        expect((await http().get(path).expect(401)).body).toMatchObject({
          code: 'UNAUTHENTICATED',
        });
      }
    });

    it('opens the stream of a seller to its owner and its staff, and to nobody else', async () => {
      const staff = await signIn(testApp, 'staff@studiolila.cz');
      const stranger = await signIn(testApp, 'stranger@example.cz');
      const user = await testApp.prisma.user.findUniqueOrThrow({
        where: { email: 'staff@studiolila.cz' },
      });

      await testApp.prisma.sellerMember.create({
        data: { sellerId, userId: user.id, role: SellerMemberRole.STAFF },
      });

      await listen(seller, ofSeller());
      await listen(staff, ofSeller());

      for (const tokens of [stranger, moderator]) {
        expect((await get(tokens, ofSeller()).expect(403)).body).toMatchObject({
          code: 'FORBIDDEN',
        });
      }
    });

    it('is closed on the side of the team to a buyer and to the seller', async () => {
      const buyer = await signIn(testApp, 'buyer@example.cz');

      for (const tokens of [buyer, seller]) {
        expect((await get(tokens, ofTeam).expect(403)).body).toMatchObject({ code: 'FORBIDDEN' });
      }
    });

    it.each(Object.values(PlatformRole))('lets the team role %s listen', async (role) => {
      await listen(await signInTeamMember(testApp, 'member@bluberi.cz', [role]), ofTeam);
    });
  });

  describe('the conversations', () => {
    it('are heard at once on both sides when either side writes', async () => {
      const ofSellerPage = await listen(seller, ofSeller());
      const ofTeamPage = await listen(moderator, ofTeam);
      const id = await fromTeam();

      expect(await ofSellerPage.next()).toEqual(conversationChanged(id));
      expect(await ofTeamPage.next()).toEqual(conversationChanged(id));

      await post(seller, `/v1/sellers/${sellerId}/conversations/${id}/messages`, {
        body: answer,
      }).expect(201);

      expect(await ofTeamPage.next()).toEqual(conversationChanged(id));
      expect(await ofSellerPage.next()).toEqual(conversationChanged(id));

      const own = await fromSeller();

      expect(await ofTeamPage.next()).toEqual(conversationChanged(own));
      expect(await ofSellerPage.next()).toEqual(conversationChanged(own));
    });

    it('are heard when one is read, and not when there was nothing to read', async () => {
      const ofTeamPage = await listen(moderator, ofTeam);
      const first = await fromSeller();
      const reading = `/v1/admin/conversations/${first}/reading`;

      expect(await ofTeamPage.next()).toEqual(conversationChanged(first));

      await post(moderator, reading).expect(204);

      expect(await ofTeamPage.next()).toEqual(conversationChanged(first));

      // Read once more: nothing changes, so nothing is said. The next thing heard is the new conversation.
      await post(moderator, reading).expect(204);

      const second = await fromSeller();

      expect(await ofTeamPage.next()).toEqual(conversationChanged(second));
    });
  });

  describe('the sellers', () => {
    it('tell the team of every step of a registration, and that it was sent', async () => {
      const ofTeamPage = await listen(moderator, ofTeam);
      const other = await otherSeller();

      // The company, the way of payouts, the bank account, the check of it, the store and a document.
      for (let step = 0; step < 6; step += 1) {
        expect(await ofTeamPage.next()).toEqual(sellerChanged(other.sellerId));
      }

      // Reading the registration is not a step.
      await get(other.tokens, '/v1/seller-registration').expect(200);
      await send(other.tokens, 'submission').expect(200);

      expect(await ofTeamPage.next()).toEqual(sellerChanged(other.sellerId));
      expect(
        (
          (await get(moderator, '/v1/admin/sellers?status=PENDING_REVIEW').expect(200)).body as {
            items: { id: string }[];
          }
        ).items.map(({ id }) => id),
      ).toContain(other.sellerId);
    });

    it('tell both sides of a decision of the team: the letter and the new status', async () => {
      const ofSellerPage = await listen(seller, ofSeller());
      const ofTeamPage = await listen(moderator, ofTeam);

      await decide('document-request', { message: 'Pošlete prosím výpis z rejstříku.' }).expect(
        200,
      );

      const [registration] = (
        (await get(seller, `/v1/sellers/${sellerId}/conversations`).expect(200))
          .body as ConversationsPage
      ).items;

      for (const page of [ofSellerPage, ofTeamPage]) {
        expect(await page.next()).toEqual(conversationChanged(registration?.id ?? ''));
        expect(await page.next()).toEqual(sellerChanged());
      }
    });

    it('tell the team that the seller added a document and sent the registration again', async () => {
      await decide('document-request', { message: 'Pošlete prosím výpis z rejstříku.' }).expect(
        200,
      );
      await liveEventsHeard(testApp);

      const ofTeamPage = await listen(moderator, ofTeam);

      await http()
        .post('/v1/seller-registration/documents')
        .set(...bearer(seller))
        .field('kind', 'REGISTER_EXTRACT')
        .field('fileName', 'Výpis.pdf')
        .attach('file', pdf, 'upload.bin')
        .expect(200);

      expect(await ofTeamPage.next()).toEqual(sellerChanged());

      await send(seller, 'resubmission').expect(200);

      expect(await ofTeamPage.next()).toEqual(sellerChanged());
    });

    it('tell a refused seller that the team took the registration back', async () => {
      await decide('rejection', { message: 'Firma podle rejstříku zanikla.' }).expect(200);
      await liveEventsHeard(testApp);

      const ofSellerPage = await listen(seller, ofSeller());

      await decide('reopening').expect(200);

      expect(await ofSellerPage.next()).toEqual(sellerChanged());
    });

    it('tell the team that a registration nobody sent was deleted', async () => {
      const other = await otherSeller();

      await liveEventsHeard(testApp);

      const ofTeamPage = await listen(moderator, ofTeam);

      await http()
        .delete(`/v1/admin/sellers/${other.sellerId}`)
        .set(...bearer(moderator))
        .expect(204);

      expect(await ofTeamPage.next()).toEqual(sellerChanged(other.sellerId));
    });

    it('tell both sides what the payment provider answered', async () => {
      const ofSellerPage = await listen(seller, ofSeller());
      const ofTeamPage = await listen(moderator, ofTeam);

      // The provider has checked the account. The API learns it when the account is read next.
      testApp.payouts.checkResult = PayoutAccountStatus.VERIFIED;
      await get(seller, '/v1/seller-registration').expect(200);

      expect(await ofSellerPage.next()).toEqual(sellerChanged());
      expect(await ofTeamPage.next()).toEqual(sellerChanged());

      // Read again: the account is checked already, so nothing more is said.
      await get(seller, '/v1/seller-registration').expect(200);

      const id = await fromTeam();

      expect(await ofTeamPage.next()).toEqual(conversationChanged(id));
    });

    it('keep the changes of one seller from the people of another', async () => {
      const other = await otherSeller();

      await send(other.tokens, 'submission').expect(200);
      await liveEventsHeard(testApp);

      const ofOtherPage = await listen(other.tokens, ofSeller(other.sellerId));

      await fromTeam();
      await decide('document-request', { message: 'Pošlete prosím výpis z rejstříku.' }).expect(
        200,
      );

      const theirs = await fromTeam(other.sellerId);

      // Nothing of the first seller was heard: the first change is their own.
      expect(await ofOtherPage.next()).toEqual(conversationChanged(theirs, other.sellerId));
    });

    it('say nothing of sellers to a person of the team who may not open them', async () => {
      const logistics = await signInTeamMember(testApp, 'karel@bluberi.cz', [
        PlatformRole.LOGISTICS,
      ]);
      const other = await otherSeller();

      await liveEventsHeard(testApp);

      const ofTeamPage = await listen(logistics, ofTeam);

      await send(other.tokens, 'submission').expect(200);

      const id = await fromSeller();

      // The registration that was sent is not heard. The conversations are a section this person has.
      expect(await ofTeamPage.next()).toEqual(conversationChanged(id));
    });
  });

  describe('the newsletter', () => {
    const subscribe = (email: string): request.Test =>
      http().post('/v1/newsletter').send({ email, locale: 'cs', consent: true });

    it('tells the owner of a sign-up and of a person who left, and nobody else', async () => {
      const platformOwner = await signInTeamMember(testApp, 'owner@bluberi.cz', [
        PlatformRole.OWNER,
      ]);
      const ofOwnerPage = await listen(platformOwner, ofTeam);
      const ofModeratorPage = await listen(moderator, ofTeam);

      await subscribe('jana@example.cz').expect(204);

      expect(await ofOwnerPage.next()).toEqual(newsletterChanged);

      // The same email again changes nothing, so nothing is said.
      await subscribe('jana@example.cz').expect(204);
      await http().post('/v1/newsletter/removal').send({ email: 'jana@example.cz' }).expect(204);

      expect(await ofOwnerPage.next()).toEqual(newsletterChanged);

      // Nobody is on the list any more: leaving again changes nothing either.
      await http().post('/v1/newsletter/removal').send({ email: 'jana@example.cz' }).expect(204);

      const id = await fromSeller();

      // The moderator has no access to marketing: the first thing heard is the conversation.
      expect(await ofModeratorPage.next()).toEqual(conversationChanged(id));
      expect(await ofOwnerPage.next()).toEqual(conversationChanged(id));
    });
  });
});
