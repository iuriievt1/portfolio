import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuditLogItem, AuditLogPage } from '../src/audit/audit-log.dto.js';
import type { AuthTokens, CurrentUser } from '../src/auth/auth.dto.js';
import { PlatformRole } from '../src/generated/prisma/enums.js';
import { TeamService } from '../src/team/team.service.js';
import {
  addSellerStaff,
  bearer,
  createSeller,
  lastCode,
  requestEmailCode,
  signIn,
  signInTeamMember,
  signInWithPassword,
} from './support/actors.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const password = 'correct horse battery';
const rolesWithoutAccessToRoles = Object.values(PlatformRole).filter(
  (role) => role !== PlatformRole.OWNER,
);

interface StoredEntry {
  readonly action: string;
  readonly actor: string | null;
  readonly target: string | null;
  readonly details: unknown;
}

describe('Audit log', () => {
  let testApp: TestApp;

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());

  async function userId(tokens: AuthTokens): Promise<string> {
    const response = await http()
      .get('/v1/auth/me')
      .set(...bearer(tokens))
      .expect(200);

    return (response.body as CurrentUser).id;
  }

  /** Everything in the log, oldest first, with emails in place of ids. */
  async function storedEntries(): Promise<StoredEntry[]> {
    const entries = await testApp.prisma.auditLogEntry.findMany({ orderBy: { id: 'asc' } });
    const users = await testApp.prisma.user.findMany();
    const emailById = new Map(users.map((user) => [user.id, user.email]));

    return entries.map((entry) => ({
      action: entry.action,
      actor: entry.actorId ? (emailById.get(entry.actorId) ?? entry.actorId) : null,
      target: entry.targetId ? (emailById.get(entry.targetId) ?? entry.targetId) : null,
      details: entry.details,
    }));
  }

  async function readLog(tokens: AuthTokens, query = ''): Promise<AuditLogPage> {
    const response = await http()
      .get(`/v1/admin/audit-log${query}`)
      .set(...bearer(tokens))
      .expect(200);

    return response.body as AuditLogPage;
  }

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

  describe('records', () => {
    it('a team role that was given, once', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      await signIn(testApp, 'maria@bluberi.cz');

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await http()
          .post('/v1/admin/team/roles')
          .set(...bearer(owner))
          .send({ email: 'maria@bluberi.cz', role: 'MODERATOR' })
          .expect(200);
      }

      expect(await storedEntries()).toEqual([
        {
          action: 'team.role_granted',
          actor: 'owner@bluberi.cz',
          target: 'maria@bluberi.cz',
          details: { role: 'MODERATOR' },
        },
      ]);
    });

    it('a team role that was taken away, and nothing when there was no role to take', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const maria = await signInTeamMember(testApp, 'maria@bluberi.cz', [PlatformRole.SUPPORT]);
      const mariaId = await userId(maria);

      for (const role of ['SUPPORT', 'FINANCE']) {
        await http()
          .delete(`/v1/admin/team/${mariaId}/roles/${role}`)
          .set(...bearer(owner))
          .expect(204);
      }

      expect(await storedEntries()).toEqual([
        {
          action: 'team.role_revoked',
          actor: 'owner@bluberi.cz',
          target: 'maria@bluberi.cz',
          details: { role: 'SUPPORT' },
        },
      ]);
    });

    it('nothing when an action was refused', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const buyer = await signIn(testApp, 'buyer@example.cz');
      const ownerId = await userId(owner);

      await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(buyer))
        .send({ email: 'buyer@example.cz', role: 'OWNER' })
        .expect(403);
      await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(owner))
        .send({ email: 'nobody@example.cz', role: 'SUPPORT' })
        .expect(404);
      await http()
        .delete(`/v1/admin/team/${ownerId}/roles/OWNER`)
        .set(...bearer(owner))
        .expect(409);

      expect(await storedEntries()).toEqual([]);
    });

    it('an owner added from the command line, without an actor', async () => {
      await testApp.app.get(TeamService).addOwner('founder@bluberi.cz');
      await testApp.app.get(TeamService).addOwner('founder@bluberi.cz');

      expect(await storedEntries()).toEqual([
        {
          action: 'team.role_granted',
          actor: null,
          target: 'founder@bluberi.cz',
          details: { role: 'OWNER' },
        },
      ]);
    });

    it('seller staff that was added and removed', async () => {
      const owner = await signIn(testApp, 'owner@studiolila.cz');
      const petr = await signIn(testApp, 'petr@example.cz');
      const sellerId = await createSeller(testApp, 'owner@studiolila.cz');
      const petrId = await userId(petr);

      await http()
        .post(`/v1/sellers/${sellerId}/members`)
        .set(...bearer(owner))
        .send({ email: 'petr@example.cz' })
        .expect(201);
      await http()
        .delete(`/v1/sellers/${sellerId}/members/${petrId}`)
        .set(...bearer(owner))
        .expect(204);

      expect(await storedEntries()).toEqual([
        {
          action: 'seller.staff_added',
          actor: 'owner@studiolila.cz',
          target: 'petr@example.cz',
          details: { sellerId },
        },
        {
          action: 'seller.staff_removed',
          actor: 'owner@studiolila.cz',
          target: 'petr@example.cz',
          details: { sellerId },
        },
      ]);
    });

    it('nothing when a change of seller staff was refused or changed nothing', async () => {
      const owner = await signIn(testApp, 'owner@studiolila.cz');
      const staff = await signIn(testApp, 'staff@studiolila.cz');
      const sellerId = await createSeller(testApp, 'owner@studiolila.cz');
      const ownerId = await userId(owner);

      await addSellerStaff(testApp, sellerId, 'staff@studiolila.cz');

      const membersUrl = `/v1/sellers/${sellerId}/members`;

      await http()
        .post(membersUrl)
        .set(...bearer(staff))
        .send({ email: 'staff@studiolila.cz' })
        .expect(403);
      await http()
        .post(membersUrl)
        .set(...bearer(owner))
        .send({ email: 'staff@studiolila.cz' })
        .expect(409);
      await http()
        .post(membersUrl)
        .set(...bearer(owner))
        .send({ email: 'nobody@example.cz' })
        .expect(404);
      await http()
        .delete(`${membersUrl}/${ownerId}`)
        .set(...bearer(owner))
        .expect(409);
      await http()
        .delete(`${membersUrl}/018f3b6e-7b1a-7c3e-9d2f-1a2b3c4d5e6f`)
        .set(...bearer(owner))
        .expect(204);

      expect(await storedEntries()).toEqual([]);
    });

    it('a password that was set, and nothing when the current password was wrong', async () => {
      const tokens = await signIn(testApp, 'jana@example.cz');

      await http()
        .put('/v1/auth/password')
        .set(...bearer(tokens))
        .send({ newPassword: password })
        .expect(204);
      await http()
        .put('/v1/auth/password')
        .set(...bearer(tokens))
        .send({ newPassword: 'another long password', currentPassword: 'wrong password 123' })
        .expect(401);

      expect(await storedEntries()).toEqual([
        { action: 'auth.password_changed', actor: 'jana@example.cz', target: null, details: {} },
      ]);
    });

    it('a phone number that was confirmed, and nothing for a wrong code', async () => {
      const tokens = await signIn(testApp, 'jana@example.cz');
      const phone = '+420777123456';

      await http()
        .post('/v1/auth/phone-code')
        .set(...bearer(tokens))
        .send({ phone })
        .expect(200);

      const code = lastCode(testApp.sms.sent, phone);
      const wrong = code === '000000' ? '000001' : '000000';

      await http()
        .put('/v1/auth/phone')
        .set(...bearer(tokens))
        .send({ phone, code: wrong })
        .expect(400);
      await http()
        .put('/v1/auth/phone')
        .set(...bearer(tokens))
        .send({ phone, code })
        .expect(204);

      expect(await storedEntries()).toEqual([
        { action: 'auth.phone_confirmed', actor: 'jana@example.cz', target: null, details: {} },
      ]);
    });

    it('a change of where the code of the second step goes', async () => {
      const tokens = await signIn(testApp, 'jana@example.cz');
      const chooseChannel = (channel: string): request.Test =>
        http()
          .put('/v1/auth/sign-in-confirmation-channel')
          .set(...bearer(tokens))
          .send({ channel });

      // Refused without a confirmed phone number, so nothing is written.
      await chooseChannel('SMS').expect(409);
      await chooseChannel('EMAIL').expect(204);

      expect(await storedEntries()).toEqual([
        {
          action: 'auth.sign_in_confirmation_channel_changed',
          actor: 'jana@example.cz',
          target: null,
          details: { channel: 'EMAIL' },
        },
      ]);
    });

    it('a sign-out on all devices, but not a sign-out on one device', async () => {
      const phone = await signIn(testApp, 'jana@example.cz');
      const laptop = await signIn(testApp, 'jana@example.cz');

      await http()
        .post('/v1/auth/sign-out')
        .set(...bearer(phone))
        .expect(204);
      await http()
        .post('/v1/auth/sign-out-all')
        .set(...bearer(laptop))
        .expect(204);

      expect(await storedEntries()).toEqual([
        {
          action: 'auth.signed_out_everywhere',
          actor: 'jana@example.cz',
          target: null,
          details: {},
        },
      ]);
    });

    it('every sign-in of a member of the Bluberi team, with the way they signed in', async () => {
      const first = await signInTeamMember(testApp, 'maria@bluberi.cz', [PlatformRole.SUPPORT]);

      await http()
        .put('/v1/auth/password')
        .set(...bearer(first))
        .send({ newPassword: password })
        .expect(204);
      await signIn(testApp, 'maria@bluberi.cz');
      await signInWithPassword(testApp, 'maria@bluberi.cz', password);
      await http()
        .post('/v1/auth/sign-in/password')
        .send({ email: 'maria@bluberi.cz', password: 'wrong password 123', app: 'admin' })
        .expect(401);

      const signIns = (await storedEntries()).filter((entry) => entry.action === 'auth.signed_in');

      expect(signIns).toEqual([
        {
          action: 'auth.signed_in',
          actor: 'maria@bluberi.cz',
          target: null,
          details: { method: 'EMAIL_CODE' },
        },
        {
          action: 'auth.signed_in',
          actor: 'maria@bluberi.cz',
          target: null,
          details: { method: 'PASSWORD' },
        },
      ]);
    });

    it('no sign-ins of buyers and sellers', async () => {
      await signIn(testApp, 'buyer@example.cz');
      await signIn(testApp, 'buyer@example.cz');
      await signIn(testApp, 'owner@studiolila.cz');
      await createSeller(testApp, 'owner@studiolila.cz');
      await signIn(testApp, 'owner@studiolila.cz');

      expect(await storedEntries()).toEqual([]);
    });
  });

  describe('in the database', () => {
    beforeEach(async () => {
      await testApp.app.get(TeamService).addOwner('founder@bluberi.cz');
    });

    it('cannot be changed', async () => {
      await expect(
        testApp.prisma.auditLogEntry.updateMany({ data: { action: 'something.else' } }),
      ).rejects.toThrow(/append-only/);
      expect((await storedEntries())[0]?.action).toBe('team.role_granted');
    });

    it('cannot be deleted', async () => {
      await expect(testApp.prisma.auditLogEntry.deleteMany()).rejects.toThrow(/append-only/);
      expect(await testApp.prisma.auditLogEntry.count()).toBe(1);
    });

    it('keeps the person who did something from being deleted', async () => {
      const owner = await signIn(testApp, 'founder@bluberi.cz');

      await signIn(testApp, 'maria@bluberi.cz');
      await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(owner))
        .send({ email: 'maria@bluberi.cz', role: 'SUPPORT' })
        .expect(200);

      await expect(
        testApp.prisma.user.delete({ where: { email: 'founder@bluberi.cz' } }),
      ).rejects.toThrow();
    });

    it('names a target by its kind and its id together, or not at all', async () => {
      await expect(
        testApp.prisma.auditLogEntry.create({
          data: { action: 'team.role_granted', targetType: 'user', details: {} },
        }),
      ).rejects.toThrow();
    });
  });

  describe('reading', () => {
    it('needs a signed-in user', async () => {
      const response = await http().get('/v1/admin/audit-log').expect(401);

      expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it('is forbidden for a buyer and for a seller owner', async () => {
      const buyer = await signIn(testApp, 'buyer@example.cz');
      const sellerOwner = await signIn(testApp, 'owner@studiolila.cz');

      await createSeller(testApp, 'owner@studiolila.cz');

      for (const tokens of [buyer, sellerOwner]) {
        const response = await http()
          .get('/v1/admin/audit-log')
          .set(...bearer(tokens))
          .expect(403);

        expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
      }
    });

    it.each(rolesWithoutAccessToRoles)('is forbidden for the team role %s', async (role) => {
      const tokens = await signInTeamMember(testApp, 'team@bluberi.cz', [role]);

      await http()
        .get('/v1/admin/audit-log')
        .set(...bearer(tokens))
        .expect(403);
    });

    it('shows the platform owner who did what to whom, newest first', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const maria = await signIn(testApp, 'maria@bluberi.cz');
      const mariaId = await userId(maria);
      const ownerId = await userId(owner);

      await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(owner))
        .send({ email: 'maria@bluberi.cz', role: 'MODERATOR' })
        .expect(200);
      await http()
        .delete(`/v1/admin/team/${mariaId}/roles/MODERATOR`)
        .set(...bearer(owner))
        .expect(204);

      const page = await readLog(owner);
      const person = (id: string, email: string): AuditLogItem['actor'] => ({
        id,
        email,
        firstName: null,
        lastName: null,
      });

      expect(page.nextCursor).toBeNull();
      expect(page.items).toMatchObject([
        {
          action: 'team.role_revoked',
          actor: person(ownerId, 'owner@bluberi.cz'),
          targetUser: person(mariaId, 'maria@bluberi.cz'),
          details: { role: 'MODERATOR' },
        },
        {
          action: 'team.role_granted',
          actor: person(ownerId, 'owner@bluberi.cz'),
          targetUser: person(mariaId, 'maria@bluberi.cz'),
          details: { role: 'MODERATOR' },
        },
      ]);
      expect(Date.parse(String(page.items[0]?.createdAt))).toBeGreaterThan(Date.now() - 60_000);
    });

    it('shows an action from the command line without an actor', async () => {
      await testApp.app.get(TeamService).addOwner('founder@bluberi.cz');

      const founder = await signIn(testApp, 'founder@bluberi.cz');
      const page = await readLog(founder, '?action=team.role_granted');

      expect(page.items).toMatchObject([
        {
          action: 'team.role_granted',
          actor: null,
          targetUser: { email: 'founder@bluberi.cz' },
          details: { role: 'OWNER' },
        },
      ]);
    });

    describe('page by page', () => {
      let owner: AuthTokens;

      beforeEach(async () => {
        owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

        // Five entries: Maria gets five roles one after another.
        await signIn(testApp, 'maria@bluberi.cz');

        for (const role of Object.values(PlatformRole)) {
          await http()
            .post('/v1/admin/team/roles')
            .set(...bearer(owner))
            .send({ email: 'maria@bluberi.cz', role })
            .expect(200);
        }
      });

      it('returns every entry once, in order, and no cursor after the last page', async () => {
        const roles: unknown[] = [];
        let cursor: string | null = null;
        let pages = 0;

        do {
          const page: AuditLogPage = await readLog(
            owner,
            `?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
          );

          roles.push(...page.items.map((item) => item.details.role));
          cursor = page.nextCursor;
          pages += 1;
        } while (cursor);

        expect(pages).toBe(3);
        expect(roles).toEqual(Object.values(PlatformRole).reverse());
      });

      it('returns everything on one page when the page is big enough', async () => {
        const page = await readLog(owner);

        expect(page.items).toHaveLength(5);
        expect(page.nextCursor).toBeNull();
      });

      it('filters by the person who did it', async () => {
        const maria = await signIn(testApp, 'maria@bluberi.cz');
        const mariaId = await userId(maria);
        const ownerId = await userId(owner);

        await http()
          .post('/v1/auth/sign-out-all')
          .set(...bearer(maria))
          .expect(204);

        const byMaria = await readLog(owner, `?actorId=${mariaId}`);
        const byOwner = await readLog(owner, `?actorId=${ownerId}`);

        expect(byMaria.items.map((item) => item.action)).toEqual([
          'auth.signed_out_everywhere',
          'auth.signed_in',
        ]);
        expect(byOwner.items).toHaveLength(5);
        expect(byOwner.items.every((item) => item.action === 'team.role_granted')).toBe(true);
      });

      it('filters by the action', async () => {
        await signIn(testApp, 'maria@bluberi.cz');

        const signIns = await readLog(owner, '?action=auth.signed_in');
        const revoked = await readLog(owner, '?action=team.role_revoked');

        expect(signIns.items.map((item) => item.actor?.email)).toEqual(['maria@bluberi.cz']);
        expect(revoked.items).toEqual([]);
      });

      it.each([
        '?limit=0',
        '?limit=101',
        '?limit=ten',
        '?cursor=not-an-id',
        '?actorId=not-an-id',
        '?action=unknown.action',
        '?sort=oldest',
      ])('rejects the query %s', async (query) => {
        const response = await http()
          .get(`/v1/admin/audit-log${query}`)
          .set(...bearer(owner))
          .expect(400);

        expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      });
    });
  });

  it('keeps the first sign-in code out of the log', async () => {
    // Asking for a code is not an action of a known person, so the log stays empty.
    await requestEmailCode(testApp, 'jana@example.cz');

    expect(await storedEntries()).toEqual([]);
  });
});
