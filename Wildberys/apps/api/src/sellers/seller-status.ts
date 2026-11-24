import type { DatabaseClient } from '../database/database-client.js';
import type { Prisma } from '../generated/prisma/client.js';
import { SellerStatus } from '../generated/prisma/enums.js';

const { DRAFT, PENDING_REVIEW, DOCUMENTS_REQUESTED, APPROVED, REJECTED } = SellerStatus;

/**
 * What can happen to a seller, from which statuses, and where it leads.
 * Every change of the status of a seller goes through this table.
 */
export const sellerTransitions = {
  /** The owner sends the finished registration to Bluberi. */
  submit: { from: [DRAFT], to: PENDING_REVIEW },
  /** The owner answers a request for documents. */
  resubmit: { from: [DOCUMENTS_REQUESTED], to: PENDING_REVIEW },
  /** The team asks for documents. */
  requestDocuments: { from: [PENDING_REVIEW], to: DOCUMENTS_REQUESTED },
  /** The team lets the seller sell. */
  approve: { from: [PENDING_REVIEW], to: APPROVED },
  /** The team refuses the seller. */
  reject: { from: [PENDING_REVIEW, DOCUMENTS_REQUESTED], to: REJECTED },
  /** The team takes a refused seller back into the check, for example after a complaint. */
  reopen: { from: [REJECTED], to: PENDING_REVIEW },
} as const satisfies Record<
  string,
  { readonly from: readonly SellerStatus[]; readonly to: SellerStatus }
>;

export type SellerTransition = keyof typeof sellerTransitions;

/** The statuses in which the seller portal is open to the people of a seller. */
export const portalStatuses: readonly SellerStatus[] = [
  PENDING_REVIEW,
  DOCUMENTS_REQUESTED,
  APPROVED,
];

/** The statuses in which the owner adds and deletes documents. */
export const documentStatuses: readonly SellerStatus[] = [DRAFT, DOCUMENTS_REQUESTED];

/**
 * Moves a seller along one transition and writes what comes with it.
 * False when the seller is not in a status the transition starts from: nothing is changed then.
 * Two requests at once move the seller once.
 */
export async function moveSeller(
  database: DatabaseClient,
  sellerId: string,
  transition: SellerTransition,
  data: Omit<Prisma.SellerUncheckedUpdateManyInput, 'status'> = {},
): Promise<boolean> {
  const { from, to } = sellerTransitions[transition];
  const { count } = await database.seller.updateMany({
    where: { id: sellerId, status: { in: [...from] } },
    data: { ...data, status: to },
  });

  return count === 1;
}
