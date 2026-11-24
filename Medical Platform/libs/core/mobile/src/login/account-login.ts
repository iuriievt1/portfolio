import { ERROR_CODE, type MobileContract } from "@ansora/contracts"
import {
	type AuthorizationEndpointMismatchDetails,
	parseDiscoveryDocument,
	verifyAuthorizationUrl,
} from "./oidc-discovery"
import { parseLoginReturn } from "./oidc-return"

type Schemas = MobileContract.components["schemas"]

export type OidcStartRequest = Schemas["OidcStartRequest"]
export type OidcStartResponse = Schemas["OidcStartResponse"]
export type OidcCallbackRequest = Schemas["OidcCallbackRequest"]
export type Session = Schemas["Session"]

export interface LoginApi {
	startOidcLogin(request: OidcStartRequest): Promise<OidcStartResponse>
	completeOidcLogin(request: OidcCallbackRequest): Promise<Session>
}

export const LOGIN_WINDOW_RESULT = {
	RETURNED: "returned",
	CANCELLED: "cancelled",
} as const

export type LoginWindowResult =
	| { type: typeof LOGIN_WINDOW_RESULT.RETURNED; url: string }
	| { type: typeof LOGIN_WINDOW_RESULT.CANCELLED }

export interface LoginWindow {
	open(url: string, returnUrl: string): Promise<LoginWindowResult>
}

export interface DiscoveryReader {
	read(url: string): Promise<unknown>
}

export interface AccountLoginPorts {
	api: LoginApi
	window: LoginWindow
	discovery: DiscoveryReader
	discoveryUrl: string
	returnUrl: string
	problemCodeOf(error: unknown): string | undefined
}

export interface AccountLoginRequest {
	reason: OidcStartRequest["reason"]
	expectedPersonalNumber?: string
}

export const ACCOUNT_LOGIN_OUTCOME = {
	SESSION: "session",
	PIN_SETUP_REQUIRED: "pin_setup_required",
	CANCELLED: "cancelled",
	NO_CONNECTION: "no_connection",
	PROVIDER_UNAVAILABLE: "provider_unavailable",
	AUTHORIZATION_MISMATCH: "authorization_mismatch",
	REJECTED: "rejected",
} as const

export type AccountLoginOutcome =
	| { kind: typeof ACCOUNT_LOGIN_OUTCOME.SESSION; session: Session }
	| {
			kind: typeof ACCOUNT_LOGIN_OUTCOME.PIN_SETUP_REQUIRED
			complete(pinProofSetup: string): Promise<AccountLoginOutcome>
	  }
	| { kind: typeof ACCOUNT_LOGIN_OUTCOME.CANCELLED }
	| { kind: typeof ACCOUNT_LOGIN_OUTCOME.NO_CONNECTION }
	| { kind: typeof ACCOUNT_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE }
	| { kind: typeof ACCOUNT_LOGIN_OUTCOME.AUTHORIZATION_MISMATCH; details: AuthorizationEndpointMismatchDetails }
	| { kind: typeof ACCOUNT_LOGIN_OUTCOME.REJECTED; code: string }

export async function signInWithAccount(
	ports: AccountLoginPorts,
	request: AccountLoginRequest,
): Promise<AccountLoginOutcome> {
	let start: OidcStartResponse
	try {
		start = await ports.api.startOidcLogin(startRequest(request))
	} catch (error) {
		return failure(ports, error)
	}
	const verdict = await verifyAgainstDiscovery(ports, start)
	if (!verdict.ok) {
		return verdict.outcome
	}
	const opened = await ports.window.open(start.authorization_url, ports.returnUrl)
	if (opened.type === LOGIN_WINDOW_RESULT.CANCELLED) {
		return { kind: ACCOUNT_LOGIN_OUTCOME.CANCELLED }
	}
	const returned = parseLoginReturn(opened.url)
	if (returned === undefined || returned.state !== start.state) {
		return { kind: ACCOUNT_LOGIN_OUTCOME.REJECTED, code: ERROR_CODE.COMPLETION_CODE_INVALID }
	}
	return await complete(ports, { state: returned.state, completion_code: returned.completionCode })
}

function startRequest(request: AccountLoginRequest): OidcStartRequest {
	const body: OidcStartRequest = {}
	if (request.reason !== undefined) {
		body.reason = request.reason
	}
	if (request.expectedPersonalNumber !== undefined) {
		body.expected_personal_number = request.expectedPersonalNumber
	}
	return body
}

async function verifyAgainstDiscovery(
	ports: AccountLoginPorts,
	start: OidcStartResponse,
): Promise<{ ok: true } | { ok: false; outcome: AccountLoginOutcome }> {
	let document: unknown
	try {
		document = await ports.discovery.read(ports.discoveryUrl)
	} catch {
		return { ok: false, outcome: { kind: ACCOUNT_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE } }
	}
	const discovery = parseDiscoveryDocument(document)
	if (discovery === undefined) {
		return { ok: false, outcome: { kind: ACCOUNT_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE } }
	}
	const verdict = verifyAuthorizationUrl(start, discovery, ports.discoveryUrl)
	if (!verdict.ok) {
		return { ok: false, outcome: { kind: ACCOUNT_LOGIN_OUTCOME.AUTHORIZATION_MISMATCH, details: verdict.details } }
	}
	return { ok: true }
}

async function complete(ports: AccountLoginPorts, callback: OidcCallbackRequest): Promise<AccountLoginOutcome> {
	try {
		return { kind: ACCOUNT_LOGIN_OUTCOME.SESSION, session: await ports.api.completeOidcLogin(callback) }
	} catch (error) {
		if (ports.problemCodeOf(error) === ERROR_CODE.PIN_SETUP_REQUIRED && callback.pin_proof_setup === undefined) {
			return {
				kind: ACCOUNT_LOGIN_OUTCOME.PIN_SETUP_REQUIRED,
				complete: (pinProofSetup) => complete(ports, { ...callback, pin_proof_setup: pinProofSetup }),
			}
		}
		return failure(ports, error)
	}
}

function failure(ports: AccountLoginPorts, error: unknown): AccountLoginOutcome {
	const code = ports.problemCodeOf(error)
	if (code === undefined) {
		return { kind: ACCOUNT_LOGIN_OUTCOME.NO_CONNECTION }
	}
	if (code === ERROR_CODE.PROVIDER_UNAVAILABLE) {
		return { kind: ACCOUNT_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE }
	}
	return { kind: ACCOUNT_LOGIN_OUTCOME.REJECTED, code }
}
