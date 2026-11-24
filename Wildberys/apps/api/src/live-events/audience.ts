import { hasPlatformAccess, type PlatformArea } from '../access/platform-access.js';
import type { PlatformRole } from '../generated/prisma/enums.js';
import type { Change } from './live-events.js';

// Who hears which change. An event carries no content, but it still says that something happened,
// so a person hears only about what they may open.

/** The sections of the admin that show each kind of change. Access to one of them is enough to hear it. */
const sectionsOf: Record<Change['kind'], readonly PlatformArea[]> = {
  'conversation-changed': ['supportTickets', 'sellers'],
  'seller-changed': ['sellers'],
  'newsletter-changed': ['marketing'],
};

/** The sections whose changes the stream of the team tells about. */
export const liveSections: readonly PlatformArea[] = [...new Set(Object.values(sectionsOf).flat())];

/** A person who works for a seller hears everything about that seller, and nothing else. */
export function concernsSeller(sellerId: string): (change: Change) => boolean {
  return (change) => 'sellerId' in change && change.sellerId === sellerId;
}

/** A member of the team hears the changes of the sections their roles open. */
export function concernsTeamMember(roles: readonly PlatformRole[]): (change: Change) => boolean {
  return (change) => sectionsOf[change.kind].some((area) => hasPlatformAccess(roles, area, 'view'));
}
