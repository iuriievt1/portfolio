/**
 * Query keys shared by the switchers. They live here so both providers can
 * exclude each other's lists when resetting account- or store-scoped queries.
 */

/** Identity lookups are keyed by token, so they survive a store switch. */
export const ACCOUNT_IDENTITIES_QUERY_KEY = ['account-identities'] as const

/** The store list is not account-scoped, so it survives an account switch. */
export const STORES_QUERY_KEY = ['stores'] as const

/** True when a query belongs to neither switcher's list and must refetch on a switch. */
export function isSwitchScopedQuery(queryKey: readonly unknown[]): boolean {
	return queryKey[0] !== ACCOUNT_IDENTITIES_QUERY_KEY[0] && queryKey[0] !== STORES_QUERY_KEY[0]
}
