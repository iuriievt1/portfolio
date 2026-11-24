import type { SellerStatus } from '@bluberi/api-client';
import type { Route } from 'next';

/** The list of sellers, as in the menu. The card of a seller is under it. */
export const sellersPath = '/moderation/sellers';

/**
 * The tabs of the list, in the order they are shown: a tab for a status.
 * A suspended seller has no tab: nobody can suspend a seller yet.
 */
export const sellerTabs = [
  'PENDING_REVIEW',
  'DOCUMENTS_REQUESTED',
  'APPROVED',
  'REJECTED',
  'DRAFT',
] as const satisfies readonly SellerStatus[];

export type SellerTab = (typeof sellerTabs)[number];

/** The tab the list opens with: the sellers who wait for the team. */
export const defaultSellerTab = 'PENDING_REVIEW' satisfies SellerTab;

/** The tab named in the address of the list. A name no tab has opens the first one. */
export function sellerTabOf(status: string | string[] | undefined): SellerTab {
  return sellerTabs.find((tab) => tab === status) ?? defaultSellerTab;
}

/** What the address of the list holds for a tab. The first tab is the list itself. */
export function sellerTabQuery(tab: SellerTab): { readonly status: SellerTab } | undefined {
  return tab === defaultSellerTab ? undefined : { status: tab };
}

/** The address of a tab of the list. */
export function sellerTabPath(tab: SellerTab): Route {
  return tab === defaultSellerTab ? sellersPath : `${sellersPath}?status=${tab}`;
}

/** The card of one seller. */
export function sellerPath(sellerId: string): Route {
  return `${sellersPath}/${sellerId}` as Route;
}

/**
 * The address a document of a seller opens at. It is a route of the admin, which asks the API
 * for the file as the signed-in person.
 */
export function sellerDocumentPath(sellerId: string, documentId: string): string {
  return `${sellersPath}/${sellerId}/documents/${documentId}`;
}
