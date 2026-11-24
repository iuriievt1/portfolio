import type { PlatformAccess } from '@bluberi/api-client';

/** A section of the admin whose access the API decides: a row of the "Роли и доступы" table. */
export type Area = keyof PlatformAccess;

export const groups = ['moderation', 'support', 'finance', 'operations', 'system'] as const;

export type Group = (typeof groups)[number];

interface SectionDefinition {
  /** The name of the section in the texts. */
  readonly key: string;
  /** The URL of the section, as in design 04. Each section has a page in app/(panel). */
  readonly path: string;
  /** Whose access rule the section follows. */
  readonly area: Area;
  /** The group in the menu. The overview stands alone above the groups. */
  readonly group: Group | null;
}

/** The menu of the admin, in the order of design 04. */
export const sections = [
  { key: 'overview', path: '/overview', area: 'overview', group: null },
  { key: 'sellers', path: '/moderation/sellers', area: 'sellers', group: 'moderation' },
  { key: 'products', path: '/moderation/products', area: 'products', group: 'moderation' },
  { key: 'dsaNotices', path: '/moderation/dsa', area: 'dsaNotices', group: 'moderation' },
  { key: 'supportTickets', path: '/support', area: 'supportTickets', group: 'support' },
  { key: 'disputesAndReturns', path: '/disputes', area: 'disputesAndReturns', group: 'support' },
  { key: 'payouts', path: '/finance/payouts', area: 'payouts', group: 'finance' },
  { key: 'commissions', path: '/finance/commissions', area: 'commissions', group: 'finance' },
  { key: 'logistics', path: '/logistics', area: 'logistics', group: 'operations' },
  { key: 'catalog', path: '/catalog', area: 'catalog', group: 'operations' },
  { key: 'marketing', path: '/marketing', area: 'marketing', group: 'operations' },
  { key: 'roles', path: '/system/roles', area: 'roles', group: 'system' },
  // In the design the audit log is on the roles screen, so it follows the access to roles.
  { key: 'auditLog', path: '/system/audit', area: 'roles', group: 'system' },
] as const satisfies readonly SectionDefinition[];

export type Section = (typeof sections)[number];

/** The sections a person may open: every level of access except none. */
export function visibleSections(access: PlatformAccess): Section[] {
  return sections.filter((section) => access[section.area] !== 'none');
}
