export type Fetch = typeof fetch

type FetchInput = Parameters<Fetch>[0]

// ADR-050 bod 10
export const REQUEST_TIMEOUT_MILLISECONDS = 10_000
// backend.md 3.1, ADR-050 bod 11
export const READ_TIMEOUT_MILLISECONDS = 400
// CAP-021-R36
const BINARY_TRANSFER_TIMEOUT_MILLISECONDS = 120_000

// startClientLogin
const SIGN_IN_PATHS = ["oauth2/", "auth/"] as const

function withTimeout(inner: Fetch, timeoutOf: (input: FetchInput) => number): Fetch {
	return (input, init) => inner(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutOf(input)) })
}

function urlOf(input: FetchInput): string {
	if (typeof input === "string") {
		return input
	}
	return input instanceof URL ? input.href : input.url
}

export function timedFetch(inner: Fetch): Fetch {
	return withTimeout(inner, () => REQUEST_TIMEOUT_MILLISECONDS)
}

// backend.md 3.1, ADR-050 bod 10, ADR-050 bod 11
export function readTimeoutOf(url: string, baseUrl: string): number {
	const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
	const isSignIn = SIGN_IN_PATHS.some((path) => url.startsWith(`${base}${path}`))
	return isSignIn ? REQUEST_TIMEOUT_MILLISECONDS : READ_TIMEOUT_MILLISECONDS
}

// backend.md 3.1, CAP-020-R16
export function readFetch(inner: Fetch, baseUrl: string): Fetch {
	return withTimeout(inner, (input) => readTimeoutOf(urlOf(input), baseUrl))
}

// CAP-021-R36
export function binaryTransferSignal(): AbortSignal {
	return AbortSignal.timeout(BINARY_TRANSFER_TIMEOUT_MILLISECONDS)
}
