import type { PlatformRole } from '../generated/prisma/enums.js';

/** The sections of the admin. */
export const platformAreas = [
  'overview',
  'sellers',
  'products',
  'dsaNotices',
  'supportTickets',
  'disputesAndReturns',
  'payouts',
  'commissions',
  'logistics',
  'catalog',
  'marketing',
  'roles',
] as const;

export type PlatformArea = (typeof platformAreas)[number];

/** "view" is read only. "full" also allows changes. */
export type AccessLevel = 'none' | 'view' | 'full';

const levelRank: Record<AccessLevel, number> = { none: 0, view: 1, full: 2 };

/**
 * What each role of the Bluberi team may do in each section of the admin.
 * The table is the "Роли и доступы" screen of design 04.
 */
export const platformAccess: Record<PlatformArea, Record<PlatformRole, AccessLevel>> = {
  overview: {
    OWNER: 'full',
    SUPPORT: 'view',
    MODERATOR: 'view',
    FINANCE: 'view',
    LOGISTICS: 'view',
  },
  sellers: {
    OWNER: 'full',
    SUPPORT: 'view',
    MODERATOR: 'full',
    FINANCE: 'view',
    LOGISTICS: 'none',
  },
  products: {
    OWNER: 'full',
    SUPPORT: 'view',
    MODERATOR: 'full',
    FINANCE: 'none',
    LOGISTICS: 'none',
  },
  dsaNotices: {
    OWNER: 'full',
    SUPPORT: 'view',
    MODERATOR: 'full',
    FINANCE: 'none',
    LOGISTICS: 'none',
  },
  supportTickets: {
    OWNER: 'full',
    SUPPORT: 'full',
    MODERATOR: 'view',
    FINANCE: 'view',
    LOGISTICS: 'view',
  },
  disputesAndReturns: {
    OWNER: 'full',
    SUPPORT: 'full',
    MODERATOR: 'view',
    FINANCE: 'view',
    LOGISTICS: 'none',
  },
  payouts: {
    OWNER: 'full',
    SUPPORT: 'none',
    MODERATOR: 'none',
    FINANCE: 'full',
    LOGISTICS: 'none',
  },
  commissions: {
    OWNER: 'full',
    SUPPORT: 'none',
    MODERATOR: 'none',
    FINANCE: 'full',
    LOGISTICS: 'none',
  },
  logistics: {
    OWNER: 'full',
    SUPPORT: 'view',
    MODERATOR: 'none',
    FINANCE: 'none',
    LOGISTICS: 'full',
  },
  catalog: {
    OWNER: 'full',
    SUPPORT: 'none',
    MODERATOR: 'full',
    FINANCE: 'none',
    LOGISTICS: 'none',
  },
  // Design 04 has the section in its menu but not in its table. The project owner decided: the owner only.
  marketing: {
    OWNER: 'full',
    SUPPORT: 'none',
    MODERATOR: 'none',
    FINANCE: 'none',
    LOGISTICS: 'none',
  },
  roles: { OWNER: 'full', SUPPORT: 'none', MODERATOR: 'none', FINANCE: 'none', LOGISTICS: 'none' },
};

export const accessLevels = ['none', 'view', 'full'] as const satisfies readonly AccessLevel[];

/** A user with several roles gets the highest level any of them gives. */
export function platformAccessLevel(
  roles: readonly PlatformRole[],
  area: PlatformArea,
): AccessLevel {
  return roles
    .map((role) => platformAccess[area][role])
    .reduce<AccessLevel>(
      (highest, level) => (levelRank[level] > levelRank[highest] ? level : highest),
      'none',
    );
}

export function hasPlatformAccess(
  roles: readonly PlatformRole[],
  area: PlatformArea,
  required: Exclude<AccessLevel, 'none'>,
): boolean {
  return levelRank[platformAccessLevel(roles, area)] >= levelRank[required];
}

/** The level of access to every section of the admin for a user with these roles. */
export function platformAccessFor(
  roles: readonly PlatformRole[],
): Record<PlatformArea, AccessLevel> {
  const access = {} as Record<PlatformArea, AccessLevel>;

  for (const area of platformAreas) {
    access[area] = platformAccessLevel(roles, area);
  }

  return access;
}
