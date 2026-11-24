import type { PayoutAccountStatus, SellerStatus } from '@bluberi/api-client';
import type { BadgeTone } from '@bluberi/ui/components/badge';

/** The colour of the badge of each status of a seller. */
export const sellerStatusTones = {
  DRAFT: 'gray',
  PENDING_REVIEW: 'amber',
  DOCUMENTS_REQUESTED: 'violet',
  APPROVED: 'green',
  REJECTED: 'red',
  SUSPENDED: 'gray',
} as const satisfies Record<SellerStatus, BadgeTone>;

/** The colour of the badge of each status of a payout account. */
export const payoutStatusTones = {
  INCOMPLETE: 'gray',
  PENDING: 'amber',
  VERIFIED: 'green',
} as const satisfies Record<PayoutAccountStatus, BadgeTone>;
