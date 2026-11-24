import type { Request } from "express"

export const SAFE_METHODS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"])
const SAME_ORIGIN = "same-origin"
const FETCH_SITE_HEADER = "sec-fetch-site"
const ORIGIN_HEADER = "origin"

// CAP-004-R05
export function isCrossSiteRequest(request: Request): boolean {
	if (SAFE_METHODS.has(request.method)) {
		return false
	}
	const fetchSite = request.get(FETCH_SITE_HEADER)
	if (fetchSite !== undefined) {
		return fetchSite !== SAME_ORIGIN
	}
	const origin = request.get(ORIGIN_HEADER)
	if (origin === undefined) {
		return false
	}
	return hostOf(origin) !== request.host
}

function hostOf(origin: string): string | undefined {
	try {
		return new URL(origin).host
	} catch {
		return undefined
	}
}
