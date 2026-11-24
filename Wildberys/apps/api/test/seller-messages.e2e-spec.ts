import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthTokens } from '../src/auth/auth.dto.js';
import { PlatformRole, SellerMemberRole } from '../src/generated/prisma/enums.js';
import type {
  ConversationsPage,
  ConversationThread,
  TeamConversationsPage,
  TeamConversationThread,
} from '../src/seller-messages/seller-messages.dto.js';
import type { ModeratedSellersPage } from '../src/seller-moderation/seller-moderation.dto.js';
import { bearer, signIn, signInTeamMember } from './support/actors.js';
import { createCategories, type TestCategories } from './support/catalog.js';
import { prepareSeller, registerSeller, studioLila } from './support/sellers.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const owner = { email: 'jana@studiolila.cz', phone: '+420777123456' };
const subject = 'Dotaz ke kategoriím';
const question = 'Dobrý den, prodáváte i dětské oblečení?';
const answer = 'Dobrý den, ano, od 2 do 10 let.';
const unknown = '0193a7c2-0000-7000-8000-000000000001';

describe('Seller messages', () => {
  let testApp: TestApp;
  let categories: TestCategories;
  let moderator: AuthTokens;
  let seller: AuthTokens;
  let sellerId: string;

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());
  const ofSeller = (path = ''): string => `/v1/sellers/${sellerId}/conversations${path}`;
  const ofTeam = (path = ''): string => `/v1/admin/conversations${path}`;
  const toSeller = (): string => `/v1/admin/sellers/${sellerId}/conversations`;
  const get = (tokens: AuthTokens, path: string): request.Test =>
    http()
      .get(path)
      .set(...bearer(tokens));
  const post = (tokens: AuthTokens, path: string, body: object = {}): request.Test =>
    http()
      .post(path)
      .set(...bearer(tokens))
      .send(body);
  const decide = (decision: string, body: object = {}): request.Test =>
    post(moderator, `/v1/admin/sellers/${sellerId}/${decision}`, body);
  const idOf = (response: request.Response): string => (response.body as { id: string }).id;
  const inboxOfSeller = async (): Promise<ConversationsPage> =>
    (await get(seller, ofSeller()).expect(200)).body as ConversationsPage;
  const inboxOfTeam = async (query = ''): Promise<TeamConversationsPage> =>
    (await get(moderator, ofTeam(query)).expect(200)).body as TeamConversationsPage;
  const threadOfSeller = async (id: string): Promise<ConversationThread> =>
    (await get(seller, ofSeller(`/${id}`)).expect(200)).body as ConversationThread;
  const threadOfTeam = async (id: string): Promise<TeamConversationThread> =>
    (await get(moderator, ofTeam(`/${id}`)).expect(200)).body as TeamConversationThread;
  const unread = async (tokens: AuthTokens, path: string): Promise<number> =>
    ((await get(tokens, path).expect(200)).body as { count: number }).count;
  const emailsToSeller = (): { subject: string; text: string }[] =>
    testApp.mail.sent.filter(({ to }) => to === owner.email);

  /** A conversation the team opened with the seller. */
  const fromTeam = async (): Promise<string> =>
    idOf(await post(moderator, toSeller(), { subject, body: question }).expect(201));

  /** A person with an account who works for the seller as staff. */
  async function staffMember(): Promise<AuthTokens> {
    const tokens = await signIn(testApp, 'staff@studiolila.cz');
    const user = await testApp.prisma.user.findUniqueOrThrow({
      where: { email: 'staff@studiolila.cz' },
    });

    await testApp.prisma.sellerMember.create({
      data: { sellerId, userId: user.id, role: SellerMemberRole.STAFF },
    });

    return tokens;
  }

  /** Another seller with a person of its own. */
  const otherSeller = (): ReturnType<typeof prepareSeller> =>
    prepareSeller(testApp, {
      email: 'petr@ateliernord.cz',
      phone: '+420602111222',
      company: { ...studioLila, ico: '25596641', legalName: 'Atelier Nord s.r.o.' },
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
    testApp.payouts.reset();
    categories = await createCategories(testApp);
    moderator = await signInTeamMember(testApp, 'maria@bluberi.cz', [PlatformRole.MODERATOR]);
    ({ tokens: seller, sellerId } = await registerSeller(testApp, {
      ...owner,
      company: studioLila,
      storeName: 'Studio Lila',
      categoryIds: [categories.women],
    }));
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('access', () => {
    it('needs a signed-in person on both sides', async () => {
      const id = await fromTeam();

      for (const path of [
        ofSeller(),
        ofSeller('/unread'),
        ofSeller(`/${id}`),
        ofTeam(),
        ofTeam('/unread'),
        ofTeam(`/${id}`),
      ]) {
        expect((await http().get(path).expect(401)).body).toMatchObject({
          code: 'UNAUTHENTICATED',
        });
      }

      for (const path of [
        ofSeller(),
        ofSeller(`/${id}/messages`),
        ofSeller(`/${id}/reading`),
        ofTeam(`/${id}/messages`),
        ofTeam(`/${id}/reading`),
        toSeller(),
      ]) {
        await http().post(path).send({ subject, body: question }).expect(401);
      }
    });

    it('opens the inbox of the seller to its owner and its staff, and to nobody else', async () => {
      const id = await fromTeam();
      const staff = await staffMember();
      const stranger = await signIn(testApp, 'stranger@example.cz');

      for (const tokens of [seller, staff]) {
        await get(tokens, ofSeller()).expect(200);
        await get(tokens, ofSeller('/unread')).expect(200);
        await get(tokens, ofSeller(`/${id}`)).expect(200);
        await post(tokens, ofSeller(`/${id}/messages`), { body: answer }).expect(201);
        await post(tokens, ofSeller(`/${id}/reading`)).expect(204);
        await post(tokens, ofSeller(), { subject, body: answer }).expect(201);
      }

      for (const tokens of [stranger, moderator]) {
        expect((await get(tokens, ofSeller()).expect(403)).body).toMatchObject({
          code: 'FORBIDDEN',
        });
        await get(tokens, ofSeller('/unread')).expect(403);
        await get(tokens, ofSeller(`/${id}`)).expect(403);
        await post(tokens, ofSeller(`/${id}/messages`), { body: answer }).expect(403);
        await post(tokens, ofSeller(`/${id}/reading`)).expect(403);
        await post(tokens, ofSeller(), { subject, body: answer }).expect(403);
      }
    });

    it('keeps the people of one seller out of the conversations of another', async () => {
      const id = await fromTeam();
      const other = await otherSeller();
      const inOther = `/v1/sellers/${other.sellerId}/conversations/${id}`;

      // Under the seller of the conversation the stranger has no role. Under their own seller it is not there.
      await get(other.tokens, ofSeller(`/${id}`)).expect(403);
      expect((await get(other.tokens, inOther).expect(404)).body).toMatchObject({
        code: 'CONVERSATION_NOT_FOUND',
      });
      await post(other.tokens, `${inOther}/messages`, { body: answer }).expect(404);
      await post(other.tokens, `${inOther}/reading`).expect(404);
      expect((await threadOfTeam(id)).messages).toHaveLength(1);
    });

    it('is closed on the side of the team to a buyer and to the seller', async () => {
      const id = await fromTeam();
      const buyer = await signIn(testApp, 'buyer@example.cz');

      for (const tokens of [buyer, seller]) {
        expect((await get(tokens, ofTeam()).expect(403)).body).toMatchObject({
          code: 'FORBIDDEN',
        });
        await get(tokens, ofTeam('/unread')).expect(403);
        await get(tokens, ofTeam(`/${id}`)).expect(403);
        await post(tokens, ofTeam(`/${id}/messages`), { body: question }).expect(403);
        await post(tokens, ofTeam(`/${id}/reading`)).expect(403);
        await post(tokens, toSeller(), { subject, body: question }).expect(403);
      }
    });

    it.each([PlatformRole.FINANCE, PlatformRole.LOGISTICS])(
      'lets the team role %s read and write nothing',
      async (role) => {
        const id = await fromTeam();
        const member = await signInTeamMember(testApp, 'member@bluberi.cz', [role]);

        await post(seller, ofSeller(`/${id}/messages`), { body: answer }).expect(201);
        await get(member, ofTeam()).expect(200);
        await get(member, ofTeam('/unread')).expect(200);
        await get(member, ofTeam(`/${id}`)).expect(200);
        await post(member, ofTeam(`/${id}/messages`), { body: question }).expect(403);
        await post(member, ofTeam(`/${id}/reading`)).expect(403);
        await post(member, toSeller(), { subject, body: question }).expect(403);

        // Reading without the right to answer leaves the message unread for the team.
        expect(await unread(member, ofTeam('/unread'))).toBe(1);
      },
    );

    it.each([PlatformRole.OWNER, PlatformRole.SUPPORT, PlatformRole.MODERATOR])(
      'lets the team role %s read, write and mark as read',
      async (role) => {
        const member = await signInTeamMember(testApp, 'member@bluberi.cz', [role]);
        const id = idOf(await post(member, toSeller(), { subject, body: question }).expect(201));

        await get(member, ofTeam()).expect(200);
        await get(member, ofTeam(`/${id}`)).expect(200);
        await post(member, ofTeam(`/${id}/messages`), { body: question }).expect(201);
        await post(member, ofTeam(`/${id}/reading`)).expect(204);
      },
    );
  });

  describe('a conversation the team opens', () => {
    it('lands in the inbox of the seller with its subject, and goes out by email', async () => {
      const id = idOf(
        await post(moderator, toSeller(), {
          subject: `  ${subject} `,
          body: `  ${question}  `,
        }).expect(201),
      );

      expect((await inboxOfSeller()).items).toMatchObject([
        {
          id,
          topic: 'GENERAL',
          subject,
          lastMessage: { side: 'TEAM', kind: 'TEXT', body: question },
          unreadCount: 1,
        },
      ]);
      expect(await threadOfSeller(id)).toMatchObject({
        id,
        subject,
        open: true,
        messages: [{ side: 'TEAM', kind: 'TEXT', body: question, readAt: null }],
        nextCursor: null,
      });
      // The seller is not told who of the team wrote.
      expect((await threadOfSeller(id)).messages[0]).not.toHaveProperty('authorEmail');
      expect(emailsToSeller().at(-1)).toMatchObject({ subject: 'Bluberi: nová zpráva od týmu' });
      expect(emailsToSeller().at(-1)?.text).toContain(question);
    });

    it('is unread for the seller until the seller opens it', async () => {
      const id = await fromTeam();

      await post(moderator, ofTeam(`/${id}/messages`), { body: 'Stačí krátká odpověď.' }).expect(
        201,
      );
      expect(await unread(seller, ofSeller('/unread'))).toBe(2);

      // Reading the inbox or the conversation changes nothing: the portal says when a person opened it.
      await inboxOfSeller();
      await threadOfSeller(id);
      expect(await unread(seller, ofSeller('/unread'))).toBe(2);

      await post(seller, ofSeller(`/${id}/reading`)).expect(204);

      expect(await unread(seller, ofSeller('/unread'))).toBe(0);
      expect((await inboxOfSeller()).items[0]).toMatchObject({ unreadCount: 0 });
      expect((await threadOfTeam(id)).messages.every(({ readAt }) => readAt !== null)).toBe(true);
    });
  });

  describe('a conversation the seller opens', () => {
    it('lands in the inbox of the team with the seller and who wrote, and sends no email', async () => {
      const sent = emailsToSeller().length;
      const id = idOf(await post(seller, ofSeller(), { subject, body: answer }).expect(201));

      expect((await inboxOfTeam()).items).toMatchObject([
        {
          id,
          topic: 'GENERAL',
          subject,
          lastMessage: { side: 'SELLER', body: answer },
          unreadCount: 1,
          seller: { id: sellerId, legalName: 'Studio Lila s.r.o.', storeName: 'Studio Lila' },
        },
      ]);
      expect(await threadOfTeam(id)).toMatchObject({
        subject,
        open: true,
        seller: { id: sellerId },
        messages: [{ side: 'SELLER', body: answer, authorEmail: owner.email, readAt: null }],
      });
      expect(emailsToSeller()).toHaveLength(sent);
    });

    it('is counted for the team until somebody who may answer opens it', async () => {
      const unreadInList = async (): Promise<number | undefined> =>
        (
          (await get(moderator, '/v1/admin/sellers?status=PENDING_REVIEW').expect(200))
            .body as ModeratedSellersPage
        ).items[0]?.unreadConversations;
      const id = idOf(await post(seller, ofSeller(), { subject, body: answer }).expect(201));

      await post(seller, ofSeller(`/${id}/messages`), { body: 'Ještě doplním.' }).expect(201);
      await post(moderator, ofTeam(`/${id}/messages`), { body: question }).expect(201);

      // What the team wrote itself is not unread for the team.
      expect(await unread(moderator, ofTeam('/unread'))).toBe(2);
      expect(await unreadInList()).toBe(1);

      await post(moderator, ofTeam(`/${id}/reading`)).expect(204);

      expect(await unread(moderator, ofTeam('/unread'))).toBe(0);
      expect(await unreadInList()).toBe(0);
      expect(await unread(seller, ofSeller('/unread'))).toBe(1);
    });
  });

  describe('the inboxes', () => {
    it('put the conversation written in last first and are read on page by page', async () => {
      const first = idOf(
        await post(moderator, toSeller(), { subject: 'První', body: question }).expect(201),
      );
      const second = idOf(
        await post(seller, ofSeller(), { subject: 'Druhá', body: answer }).expect(201),
      );

      expect((await inboxOfSeller()).items.map(({ id }) => id)).toEqual([second, first]);

      // An answer brings an older conversation back to the top.
      await post(seller, ofSeller(`/${first}/messages`), { body: answer }).expect(201);

      const page = (await get(seller, ofSeller('?limit=1')).expect(200)).body as ConversationsPage;

      expect(page.items.map(({ id }) => id)).toEqual([first]);
      expect(page.nextCursor).toBe(first);
      expect(
        (
          (await get(seller, ofSeller(`?limit=1&cursor=${first}`)).expect(200))
            .body as ConversationsPage
        ).items.map(({ id }) => id),
      ).toEqual([second]);

      // The team reads its inbox the same way.
      const teamPage = await inboxOfTeam('?limit=1');

      expect(teamPage.items.map(({ id }) => id)).toEqual([first]);
      expect(
        (await inboxOfTeam(`?limit=1&cursor=${teamPage.nextCursor ?? ''}`)).items.map(
          ({ id }) => id,
        ),
      ).toEqual([second]);
    });

    it('show the team the conversations of every seller, or of one', async () => {
      const other = await otherSeller();

      await http()
        .post('/v1/seller-registration/submission')
        .set(...bearer(other.tokens))
        .send({ selfCertified: true })
        .expect(200);
      await fromTeam();
      await post(moderator, `/v1/admin/sellers/${other.sellerId}/conversations`, {
        subject: 'Jiné téma',
        body: question,
      }).expect(201);

      expect((await inboxOfTeam()).items.map(({ seller: { legalName } }) => legalName)).toEqual([
        'Atelier Nord s.r.o.',
        'Studio Lila s.r.o.',
      ]);
      expect((await inboxOfTeam(`?sellerId=${sellerId}`)).items).toMatchObject([
        { subject, seller: { id: sellerId } },
      ]);
      // The seller sees its own conversations only.
      expect((await inboxOfSeller()).items).toHaveLength(1);
    });

    it('read the messages of a conversation newest first, page by page', async () => {
      const id = await fromTeam();

      await post(seller, ofSeller(`/${id}/messages`), { body: 'Druhá' }).expect(201);
      await post(moderator, ofTeam(`/${id}/messages`), { body: 'Třetí' }).expect(201);

      const first = (await get(seller, ofSeller(`/${id}?limit=2`)).expect(200))
        .body as ConversationThread;

      expect(first.messages.map(({ body }) => body)).toEqual(['Třetí', 'Druhá']);

      const second = (
        await get(seller, ofSeller(`/${id}?limit=2&cursor=${first.nextCursor ?? ''}`)).expect(200)
      ).body as ConversationThread;

      expect(second.messages.map(({ body }) => body)).toEqual([question]);
      expect(second.nextCursor).toBeNull();

      // The team reads a conversation the same way.
      const teamFirst = (await get(moderator, ofTeam(`/${id}?limit=2`)).expect(200))
        .body as TeamConversationThread;
      const teamSecond = (
        await get(moderator, ofTeam(`/${id}?limit=2&cursor=${teamFirst.nextCursor ?? ''}`)).expect(
          200,
        )
      ).body as TeamConversationThread;

      expect(teamFirst.messages.map(({ body }) => body)).toEqual(['Třetí', 'Druhá']);
      expect(teamSecond.messages.map(({ body }) => body)).toEqual([question]);
      expect(teamSecond.nextCursor).toBeNull();
    });
  });

  describe('the decisions of the team', () => {
    it('go into one conversation about the registration', async () => {
      await decide('document-request', { message: question }).expect(200);
      await http()
        .post('/v1/seller-registration/resubmission')
        .set(...bearer(seller))
        .expect(200);
      await decide('approval').expect(200);

      const inbox = await inboxOfSeller();

      expect(inbox.items).toMatchObject([
        {
          topic: 'REGISTRATION',
          subject: '',
          lastMessage: { side: 'TEAM', kind: 'APPROVED', body: '' },
          unreadCount: 2,
        },
      ]);
      expect((await threadOfTeam(inbox.items[0]?.id ?? '')).messages).toMatchObject([
        { kind: 'APPROVED', body: '', authorEmail: 'maria@bluberi.cz' },
        { kind: 'DOCUMENTS_REQUESTED', body: question, authorEmail: 'maria@bluberi.cz' },
      ]);
      // A decision has its own email. The email about a new message is for texts only.
      expect(emailsToSeller().map(({ subject: title }) => title)).not.toContain(
        'Bluberi: nová zpráva od týmu',
      );
    });

    it('close the conversations when the seller is refused, and the team still reads them', async () => {
      const id = await fromTeam();

      await decide('rejection', { message: 'Firma podle rejstříku zanikla.' }).expect(200);

      expect(await threadOfTeam(id)).toMatchObject({ open: false });
      for (const [tokens, path, body] of [
        [moderator, ofTeam(`/${id}/messages`), { body: question }],
        [moderator, toSeller(), { subject, body: question }],
        [seller, ofSeller(`/${id}/messages`), { body: answer }],
        [seller, ofSeller(), { subject, body: answer }],
      ] as const) {
        expect((await post(tokens, path, body).expect(409)).body).toMatchObject({
          code: 'MESSAGES_CLOSED',
        });
      }
    });
  });

  describe('what is refused', () => {
    it('is a conversation with a registration nobody sent', async () => {
      const draft = await otherSeller();

      for (const [tokens, path] of [
        [moderator, `/v1/admin/sellers/${draft.sellerId}/conversations`],
        [draft.tokens, `/v1/sellers/${draft.sellerId}/conversations`],
      ] as const) {
        expect(
          (await post(tokens, path, { subject, body: question }).expect(409)).body,
        ).toMatchObject({ code: 'MESSAGES_CLOSED' });
      }
    });

    it('is a conversation or a seller nobody has', async () => {
      expect((await get(moderator, ofTeam(`/${unknown}`)).expect(404)).body).toMatchObject({
        code: 'CONVERSATION_NOT_FOUND',
      });
      await post(moderator, ofTeam(`/${unknown}/messages`), { body: question }).expect(404);
      await post(moderator, ofTeam(`/${unknown}/reading`)).expect(404);
      await get(seller, ofSeller(`/${unknown}`)).expect(404);
      await post(moderator, `/v1/admin/sellers/${unknown}/conversations`, {
        subject,
        body: question,
      }).expect(404);
      await get(moderator, ofTeam('/not-an-id')).expect(400);
    });

    it.each([
      ['no text', { subject }],
      ['an empty text', { subject, body: '   ' }],
      ['a text that is too long', { subject, body: 'a'.repeat(2001) }],
      ['no subject', { body: answer }],
      ['an empty subject', { subject: '  ', body: answer }],
      ['a subject that is too long', { subject: 'a'.repeat(121), body: answer }],
      ['a field nobody knows', { subject, body: answer, topic: 'REGISTRATION' }],
    ])('is a new conversation with %s', async (_what, body) => {
      for (const [tokens, path] of [
        [seller, ofSeller()],
        [moderator, toSeller()],
      ] as const) {
        expect((await post(tokens, path, body).expect(400)).body).toMatchObject({
          code: 'VALIDATION_FAILED',
        });
      }

      expect(await testApp.prisma.sellerConversation.count()).toBe(0);
    });

    it('is an answer without a text, or with a subject', async () => {
      const id = await fromTeam();

      for (const body of [{}, { body: ' ' }, { subject, body: answer }]) {
        await post(seller, ofSeller(`/${id}/messages`), body).expect(400);
        await post(moderator, ofTeam(`/${id}/messages`), body).expect(400);
      }

      expect(await testApp.prisma.sellerMessage.count()).toBe(1);
    });
  });
});
