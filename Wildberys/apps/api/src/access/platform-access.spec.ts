import { describe, expect, it } from 'vitest';

import { PlatformRole } from '../generated/prisma/enums.js';
import {
  hasPlatformAccess,
  platformAccess,
  platformAreas,
  type AccessLevel,
  type PlatformArea,
} from './platform-access.js';

/**
 * The table from the "Роли и доступы" screen of design 04, written the way the design source has it:
 * one letter per role in the order owner, support, moderator, finance, logistics.
 * f is full access, v is view only, n is no access.
 */
const designTable: Record<PlatformArea, string> = {
  overview: 'fvvvv',
  sellers: 'fvfvn',
  products: 'fvfnn',
  dsaNotices: 'fvfnn',
  supportTickets: 'ffvvv',
  disputesAndReturns: 'ffvvn',
  payouts: 'fnnfn',
  commissions: 'fnnfn',
  logistics: 'fvnnf',
  catalog: 'fnfnn',
  // Not in the table of the design, only in its menu. The project owner decided: the owner only.
  marketing: 'fnnnn',
  roles: 'fnnnn',
};
const designRoles = [
  PlatformRole.OWNER,
  PlatformRole.SUPPORT,
  PlatformRole.MODERATOR,
  PlatformRole.FINANCE,
  PlatformRole.LOGISTICS,
];
const levelByLetter: Record<string, AccessLevel> = { f: 'full', v: 'view', n: 'none' };

const cases = platformAreas.flatMap((area) =>
  designRoles.map((role, index) => ({
    area,
    role,
    level: levelByLetter[designTable[area].charAt(index)],
  })),
);

describe('platform access', () => {
  it.each(cases)('gives $role "$level" access to $area', ({ area, role, level }) => {
    expect(platformAccess[area][role]).toBe(level);
    expect(hasPlatformAccess([role], area, 'view')).toBe(level !== 'none');
    expect(hasPlatformAccess([role], area, 'full')).toBe(level === 'full');
  });

  it('covers every role', () => {
    expect([...designRoles].sort()).toEqual(Object.values(PlatformRole).sort());
  });

  it('gives nothing to a user without roles', () => {
    for (const area of platformAreas) {
      expect(hasPlatformAccess([], area, 'view')).toBe(false);
    }
  });

  it('gives a user with several roles the highest level any of them has', () => {
    const roles = [PlatformRole.SUPPORT, PlatformRole.FINANCE];

    expect(hasPlatformAccess(roles, 'supportTickets', 'full')).toBe(true);
    expect(hasPlatformAccess(roles, 'payouts', 'full')).toBe(true);
    expect(hasPlatformAccess(roles, 'sellers', 'full')).toBe(false);
    expect(hasPlatformAccess(roles, 'catalog', 'view')).toBe(false);
  });
});
