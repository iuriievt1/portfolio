import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthTokens, CurrentUser } from '../src/auth/auth.dto.js';
import { PlatformRole } from '../src/generated/prisma/enums.js';
import type { SellerTeamMember } from '../src/seller-members/seller-members.dto.js';
import type { TeamMember } from '../src/team/team.dto.js';
import { TeamService } from '../src/team/team.service.js';
import {
  addSellerStaff,
  bearer,
  createSeller,
  signIn,
  signInTeamMember,
} from './support/actors.js';
import { createTestApp, resetDatabase, type TestApp } from './support/test-app.js';

const everyPlatformRole = Object.values(PlatformRole);
const rolesWithoutAccessToRoles = everyPlatformRole.filter((role) => role !== PlatformRole.OWNER);

describe('Roles', () => {
  let testApp: TestApp;

  const http = (): ReturnType<typeof request> => request(testApp.app.getHttpServer());

  async function currentUser(tokens: AuthTokens): Promise<CurrentUser> {
    const response = await http()
      .get('/v1/auth/me')
      .set(...bearer(tokens))
      .expect(200);

    return response.body as CurrentUser;
  }

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

  describe('of the signed-in user', () => {
    it('are empty for a buyer', async () => {
      const buyer = await currentUser(await signIn(testApp, 'buyer@example.cz'));

      expect(buyer.platformRoles).toEqual([]);
      expect(buyer.sellerMemberships).toEqual([]);
    });

    it('come with what they allow in each section of the admin', async () => {
      const buyer = await currentUser(await signIn(testApp, 'buyer@example.cz'));
      const owner = await currentUser(
        await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]),
      );
      const supportAndFinance = await currentUser(
        await signInTeamMember(testApp, 'maria@bluberi.cz', [
          PlatformRole.SUPPORT,
          PlatformRole.FINANCE,
        ]),
      );

      expect(new Set(Object.values(buyer.platformAccess))).toEqual(new Set(['none']));
      expect(new Set(Object.values(owner.platformAccess))).toEqual(new Set(['full']));
      expect(Object.keys(owner.platformAccess)).toHaveLength(12);
      expect(supportAndFinance.platformAccess).toEqual({
        overview: 'view',
        sellers: 'view',
        products: 'view',
        dsaNotices: 'view',
        supportTickets: 'full',
        disputesAndReturns: 'full',
        payouts: 'full',
        commissions: 'full',
        logistics: 'view',
        catalog: 'none',
        marketing: 'none',
        roles: 'none',
      });
    });

    it.each(everyPlatformRole)('include the team role %s', async (role) => {
      const member = await currentUser(await signInTeamMember(testApp, 'team@bluberi.cz', [role]));

      expect(member.platformRoles).toEqual([role]);
      expect(member.sellerMemberships).toEqual([]);
    });

    it('include the seller a person owns and the seller a person works for', async () => {
      const ownerTokens = await signIn(testApp, 'owner@studiolila.cz');
      const staffTokens = await signIn(testApp, 'staff@studiolila.cz');
      const sellerId = await createSeller(testApp, 'owner@studiolila.cz');

      await addSellerStaff(testApp, sellerId, 'staff@studiolila.cz');

      expect((await currentUser(ownerTokens)).sellerMemberships).toEqual([
        { sellerId, role: 'OWNER' },
      ]);
      expect((await currentUser(staffTokens)).sellerMemberships).toEqual([
        { sellerId, role: 'STAFF' },
      ]);
    });
  });

  describe('of the Bluberi team', () => {
    const teamRoutes = [
      { name: 'list the team', call: () => http().get('/v1/admin/team') },
      {
        name: 'give a role',
        call: () =>
          http().post('/v1/admin/team/roles').send({ email: 'buyer@example.cz', role: 'SUPPORT' }),
      },
      {
        name: 'take a role away',
        call: () =>
          http().delete('/v1/admin/team/018f3b6e-7b1a-7c3e-9d2f-1a2b3c4d5e6f/roles/SUPPORT'),
      },
    ];

    describe.each(teamRoutes)('to $name', ({ call }) => {
      it('needs a signed-in user', async () => {
        const response = await call().expect(401);

        expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED' });
      });

      it('is forbidden for a buyer', async () => {
        const tokens = await signIn(testApp, 'buyer@example.cz');
        const response = await call()
          .set(...bearer(tokens))
          .expect(403);

        expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
      });

      it('is forbidden for a seller owner', async () => {
        const tokens = await signIn(testApp, 'owner@studiolila.cz');

        await createSeller(testApp, 'owner@studiolila.cz');
        await call()
          .set(...bearer(tokens))
          .expect(403);
      });

      it.each(rolesWithoutAccessToRoles)('is forbidden for the team role %s', async (role) => {
        const tokens = await signInTeamMember(testApp, 'team@bluberi.cz', [role]);

        await call()
          .set(...bearer(tokens))
          .expect(403);
      });

      it('is allowed for the platform owner', async () => {
        const tokens = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

        await signIn(testApp, 'buyer@example.cz');

        const response = await call().set(...bearer(tokens));

        expect(response.status).toBeLessThan(300);
      });
    });

    it('lists the people with their roles', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      await signInTeamMember(testApp, 'maria@bluberi.cz', [
        PlatformRole.SUPPORT,
        PlatformRole.MODERATOR,
      ]);
      await signIn(testApp, 'buyer@example.cz');

      const response = await http()
        .get('/v1/admin/team')
        .set(...bearer(owner))
        .expect(200);
      const team = (response.body as TeamMember[]).map(({ email, roles }) => ({ email, roles }));

      expect(team).toEqual([
        { email: 'maria@bluberi.cz', roles: ['SUPPORT', 'MODERATOR'] },
        { email: 'owner@bluberi.cz', roles: ['OWNER'] },
      ]);
    });

    it('gives a role that works on the very next request', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const maria = await signIn(testApp, 'maria@bluberi.cz');

      await http()
        .get('/v1/admin/team')
        .set(...bearer(maria))
        .expect(403);

      const response = await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(owner))
        .send({ email: 'Maria@Bluberi.cz', role: 'OWNER' })
        .expect(200);

      expect(response.body).toMatchObject({ email: 'maria@bluberi.cz', roles: ['OWNER'] });
      await http()
        .get('/v1/admin/team')
        .set(...bearer(maria))
        .expect(200);
    });

    it('gives the same role twice without an error', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      await signIn(testApp, 'maria@bluberi.cz');

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await http()
          .post('/v1/admin/team/roles')
          .set(...bearer(owner))
          .send({ email: 'maria@bluberi.cz', role: 'MODERATOR' })
          .expect(200);
      }

      expect((await currentUser(await signIn(testApp, 'maria@bluberi.cz'))).platformRoles).toEqual([
        'MODERATOR',
      ]);
    });

    it('gives a role only to a person who has an account', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const response = await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(owner))
        .send({ email: 'nobody@bluberi.cz', role: 'SUPPORT' })
        .expect(404);

      expect(response.body).toMatchObject({ code: 'USER_NOT_FOUND' });
    });

    it('refuses a role that does not exist', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);

      await http()
        .post('/v1/admin/team/roles')
        .set(...bearer(owner))
        .send({ email: 'owner@bluberi.cz', role: 'KING' })
        .expect(400);
    });

    it('takes a role away, and it stops working on the very next request', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const maria = await signInTeamMember(testApp, 'maria@bluberi.cz', [PlatformRole.OWNER]);
      const mariaId = (await currentUser(maria)).id;

      await http()
        .delete(`/v1/admin/team/${mariaId}/roles/OWNER`)
        .set(...bearer(owner))
        .expect(204);

      await http()
        .get('/v1/admin/team')
        .set(...bearer(maria))
        .expect(403);
      expect((await currentUser(maria)).platformRoles).toEqual([]);
    });

    it('never leaves the platform without an owner', async () => {
      const owner = await signInTeamMember(testApp, 'owner@bluberi.cz', [PlatformRole.OWNER]);
      const ownerId = (await currentUser(owner)).id;
      const response = await http()
        .delete(`/v1/admin/team/${ownerId}/roles/OWNER`)
        .set(...bearer(owner))
        .expect(409);

      expect(response.body).toMatchObject({ code: 'LAST_OWNER' });
      expect((await currentUser(owner)).platformRoles).toEqual(['OWNER']);
    });

    it('makes the first owner from the command line, also before the person has an account', async () => {
      const added = await testApp.app.get(TeamService).addOwner('founder@bluberi.cz');

      expect(added).toMatchObject({ email: 'founder@bluberi.cz', roles: ['OWNER'] });

      const founder = await signIn(testApp, 'founder@bluberi.cz');

      expect((await currentUser(founder)).platformRoles).toEqual(['OWNER']);
      await http()
        .get('/v1/admin/team')
        .set(...bearer(founder))
        .expect(200);
    });
  });

  describe('of a seller', () => {
    let sellerId: string;
    let owner: AuthTokens;
    let staff: AuthTokens;

    const membersUrl = (): string => `/v1/sellers/${sellerId}/members`;

    beforeEach(async () => {
      owner = await signIn(testApp, 'owner@studiolila.cz');
      staff = await signIn(testApp, 'staff@studiolila.cz');
      sellerId = await createSeller(testApp, 'owner@studiolila.cz');
      await addSellerStaff(testApp, sellerId, 'staff@studiolila.cz');
    });

    const memberRoutes = [
      { name: 'list the members', call: () => http().get(membersUrl()) },
      {
        name: 'add staff',
        call: () => http().post(membersUrl()).send({ email: 'buyer@example.cz' }),
      },
      {
        name: 'remove staff',
        call: () => http().delete(`${membersUrl()}/018f3b6e-7b1a-7c3e-9d2f-1a2b3c4d5e6f`),
      },
    ];

    describe.each(memberRoutes)('to $name', ({ call }) => {
      it('needs a signed-in user', async () => {
        await call().expect(401);
      });

      it('is forbidden for the staff of the seller', async () => {
        const response = await call()
          .set(...bearer(staff))
          .expect(403);

        expect(response.body).toMatchObject({ code: 'FORBIDDEN' });
      });

      it('is forbidden for a buyer', async () => {
        const buyer = await signIn(testApp, 'buyer@example.cz');

        await call()
          .set(...bearer(buyer))
          .expect(403);
      });

      it('is forbidden for the owner of another seller', async () => {
        const stranger = await signIn(testApp, 'owner@urbanstep.cz');

        await createSeller(testApp, 'owner@urbanstep.cz');
        await call()
          .set(...bearer(stranger))
          .expect(403);
      });

      it('is forbidden for the Bluberi team, the platform owner included', async () => {
        const team = await signInTeamMember(testApp, 'owner@bluberi.cz', everyPlatformRole);

        await call()
          .set(...bearer(team))
          .expect(403);
      });

      it('is allowed for the owner of the seller', async () => {
        await signIn(testApp, 'buyer@example.cz');

        const response = await call().set(...bearer(owner));

        expect(response.status).toBeLessThan(300);
      });
    });

    it('lists the owner first, then the staff', async () => {
      const response = await http()
        .get(membersUrl())
        .set(...bearer(owner))
        .expect(200);
      const members = (response.body as SellerTeamMember[]).map(({ email, role }) => ({
        email,
        role,
      }));

      expect(members).toEqual([
        { email: 'owner@studiolila.cz', role: 'OWNER' },
        { email: 'staff@studiolila.cz', role: 'STAFF' },
      ]);
    });

    it('adds a person to the staff, and they see the seller on the very next request', async () => {
      const petr = await signIn(testApp, 'petr@example.cz');
      const response = await http()
        .post(membersUrl())
        .set(...bearer(owner))
        .send({ email: 'Petr@Example.cz' })
        .expect(201);

      expect(response.body).toMatchObject({ email: 'petr@example.cz', role: 'STAFF' });
      expect((await currentUser(petr)).sellerMemberships).toEqual([{ sellerId, role: 'STAFF' }]);
    });

    it('adds only a person who has an account, and only once', async () => {
      const unknown = await http()
        .post(membersUrl())
        .set(...bearer(owner))
        .send({ email: 'nobody@example.cz' })
        .expect(404);
      const twice = await http()
        .post(membersUrl())
        .set(...bearer(owner))
        .send({ email: 'staff@studiolila.cz' })
        .expect(409);

      expect(unknown.body).toMatchObject({ code: 'USER_NOT_FOUND' });
      expect(twice.body).toMatchObject({ code: 'ALREADY_SELLER_MEMBER' });
    });

    it('removes a person from the staff, and they lose the seller on the very next request', async () => {
      const staffId = (await currentUser(staff)).id;

      await http()
        .delete(`${membersUrl()}/${staffId}`)
        .set(...bearer(owner))
        .expect(204);

      expect((await currentUser(staff)).sellerMemberships).toEqual([]);
    });

    it('never removes the owner', async () => {
      const ownerId = (await currentUser(owner)).id;
      const response = await http()
        .delete(`${membersUrl()}/${ownerId}`)
        .set(...bearer(owner))
        .expect(409);

      expect(response.body).toMatchObject({ code: 'SELLER_OWNER_CANNOT_BE_REMOVED' });
      expect((await currentUser(owner)).sellerMemberships).toEqual([{ sellerId, role: 'OWNER' }]);
    });
  });
});
