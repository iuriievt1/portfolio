import { describe, expect, it } from 'vitest';

import { PlatformRole } from '../generated/prisma/enums.js';
import { concernsSeller, concernsTeamMember, liveSections } from './audience.js';
import type { Change } from './live-events.js';

const mine = '0193a7c2-0000-7000-8000-000000000001';
const other = '0193a7c2-0000-7000-8000-000000000002';
const conversation = '0193a7c2-0000-7000-8000-000000000003';
const message: Change = {
  kind: 'conversation-changed',
  sellerId: mine,
  conversationId: conversation,
};
const seller: Change = { kind: 'seller-changed', sellerId: mine };
const newsletter: Change = { kind: 'newsletter-changed' };

describe('who hears a change', () => {
  it('a person of a seller hears everything about that seller, and nothing else', () => {
    expect([message, seller, newsletter].map(concernsSeller(mine))).toEqual([true, true, false]);
    expect([message, seller, newsletter].map(concernsSeller(other))).toEqual([false, false, false]);
  });

  it.each([
    [PlatformRole.OWNER, [true, true, true]],
    [PlatformRole.MODERATOR, [true, true, false]],
    [PlatformRole.SUPPORT, [true, true, false]],
    [PlatformRole.FINANCE, [true, true, false]],
    // No access to sellers, but the conversations with them are also a section of the support.
    [PlatformRole.LOGISTICS, [true, false, false]],
  ])('the team role %s hears the changes of the sections it may open', (role, heard) => {
    expect([message, seller, newsletter].map(concernsTeamMember([role]))).toEqual(heard);
  });

  it('a person without a role of the team hears nothing', () => {
    expect([message, seller, newsletter].map(concernsTeamMember([]))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('the stream of the team tells of the support, the sellers and the newsletter', () => {
    expect([...liveSections].sort()).toEqual(['marketing', 'sellers', 'supportTickets']);
  });
});
