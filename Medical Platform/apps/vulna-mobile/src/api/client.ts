import {
	ACCEPT_LANGUAGE_HEADER,
	API_BASE_PATH,
	APP_VERSION_HEADER,
	AUTHORIZATION_HEADER,
	BEARER_PREFIX,
	CONTENT_TYPE_HEADER,
	DPOP_HEADER,
	ERROR_CODE,
	SIGNED_BODY_CONTENT_TYPE,
} from "@ansora/contracts"
import { createDeviceProof, cryptoAndKeys } from "@ansora/core-mobile"
import { rememberAppVersionAnswer } from "../features/app-version/app-version-store"
import { noteDeviceRevoked } from "../features/device/device-revocation-events"
import { currentLanguage } from "../i18n/language-store"
import { ApiProblemError, NoConnectionError } from "./api-error"
import { appVersionHeader } from "./app-version"
import { isNonceRequired, latestNonce, rememberNonce } from "./dpop-nonce"
import { HTTP_STATUS } from "./http-status"
import { serverUrl } from "./server-address"

// ADR-012, RFC 9449, ADR-013, Q-082, NAB-143
export type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface ApiRequest {
	method?: ApiMethod
	body?: unknown
	signedBody?: string
	sessionToken?: string
	headers?: Readonly<Record<string, string>>
	acceptsOutdatedApp?: boolean
}

export type VersionCheck = Pick<ApiRequest, "acceptsOutdatedApp">

// CAP-012-R25, index.yaml AppVersion
export const ACCEPTS_OUTDATED_APP: VersionCheck = { acceptsOutdatedApp: true }

interface Payload {
	contentType: string
	body: string | undefined
}

export const JSON_CONTENT_TYPE = "application/json"

// ADR-012
export function apiUrlOf(path: string): string {
	return `${serverUrl()}${API_BASE_PATH}${path}`
}

// RFC 9449, ADR-013, Q-082, CAP-015-R27
export async function signedRequestHeaders(
	method: ApiMethod,
	url: string,
	sessionToken: string | undefined,
): Promise<Record<string, string>> {
	const keys = cryptoAndKeys()
	const { publicKeyJwk } = await keys.deviceKey()
	const accessTokenHash = sessionToken === undefined ? undefined : await keys.sha256Text(sessionToken)
	const proof = await createDeviceProof(keys, publicKeyJwk, { method, url, nonce: latestNonce(), accessTokenHash })
	return {
		...plainRequestHeaders(),
		[DPOP_HEADER]: proof,
		...(sessionToken === undefined ? {} : { [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${sessionToken}` }),
	}
}

// CAP-015-R27, CAP-012-R24
export function plainRequestHeaders(): Record<string, string> {
	return {
		[ACCEPT_LANGUAGE_HEADER]: currentLanguage(),
		[APP_VERSION_HEADER]: appVersionHeader(),
	}
}

// RFC 9449, RFC 9457, CAP-012-R24, CAP-012-R25
export async function exchange(send: () => Promise<Response>, versionCheck: VersionCheck = {}): Promise<Response> {
	let response = await sendRemembered(send)
	if (isNonceRequired(response)) {
		response = await sendRemembered(send)
	}
	if (!response.ok) {
		const problem = await ApiProblemError.from(response)
		if (problem.code === ERROR_CODE.APP_VERSION_UNSUPPORTED) {
			rememberAppVersionAnswer(true)
		}
		// CAP-007-R11, CAP-012-S15
		if (problem.code === ERROR_CODE.DEVICE_REVOKED) {
			noteDeviceRevoked()
		}
		throw problem
	}
	if (versionCheck.acceptsOutdatedApp !== true) {
		rememberAppVersionAnswer(false)
	}
	return response
}

export async function callApi<T>(path: string, request: ApiRequest = {}): Promise<T> {
	const response = await callApiResponse(path, request)
	if (response.status === HTTP_STATUS.NO_CONTENT) {
		return undefined as T
	}
	return (await response.json()) as T
}

export async function callApiResponse(path: string, request: ApiRequest = {}): Promise<Response> {
	const url = apiUrlOf(path)
	const method = request.method ?? "GET"
	const payload = payloadOf(request)
	return await exchange(
		async () =>
			fetchFromServer(url, {
				method,
				headers: {
					[CONTENT_TYPE_HEADER]: payload.contentType,
					...(await signedRequestHeaders(method, url, request.sessionToken)),
					...request.headers,
				},
				body: payload.body,
			}),
		request,
	)
}

// CAP-002-R17, CAP-019-R29
export async function fetchFromServer(url: string, init: RequestInit): Promise<Response> {
	try {
		return await fetch(url, init)
	} catch (error) {
		throw new NoConnectionError(error)
	}
}

async function sendRemembered(send: () => Promise<Response>): Promise<Response> {
	const response = await send()
	rememberNonce(response)
	return response
}

function payloadOf(request: ApiRequest): Payload {
	if (request.signedBody !== undefined) {
		return { contentType: SIGNED_BODY_CONTENT_TYPE, body: request.signedBody }
	}
	return { contentType: JSON_CONTENT_TYPE, body: request.body === undefined ? undefined : JSON.stringify(request.body) }
}
