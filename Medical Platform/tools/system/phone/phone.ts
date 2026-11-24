import {
	ACCEPT_LANGUAGE_HEADER,
	API_BASE_PATH,
	APP_VERSION_HEADER,
	AUTHORIZATION_HEADER,
	BEARER_PREFIX,
	CONTENT_TYPE_HEADER,
	DPOP_HEADER,
	DPOP_NONCE_HEADER,
	USE_DPOP_NONCE_ERROR,
	WWW_AUTHENTICATE_HEADER,
} from "@ansora/contracts"
import type { DeviceKey } from "./device-key"

// apps/vulna-mobile/src/api/client.ts, RFC 9449, ADR-013, CAP-015-R27
const APP_VERSION = "1.0.0+1"
const LANGUAGE = "cs"
const JSON_CONTENT_TYPE = "application/json"
const HTTP_UNAUTHORIZED = 401
const HTTP_NO_CONTENT = 204
const NONCE_CHALLENGE = `error="${USE_DPOP_NONCE_ERROR}"`

type HttpMethod = "GET" | "POST" | "PATCH"

interface RequestBase {
	method?: HttpMethod
	headers?: Readonly<Record<string, string>>
	isDeviceOnly?: boolean
}

type PhoneRequest = RequestBase & ({ body?: unknown; form?: never } | { form: FormData; body?: never })

// RFC 9457
export class PhoneProblemError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		detail: string,
	) {
		super(`HTTP ${status} ${code ?? ""}: ${detail}`)
		this.name = "PhoneProblemError"
	}
}

function isNonceRequired(response: Response): boolean {
	const challenge = response.headers.get(WWW_AUTHENTICATE_HEADER) ?? ""
	return response.status === HTTP_UNAUTHORIZED && challenge.includes(NONCE_CHALLENGE)
}

async function problemOf(response: Response): Promise<PhoneProblemError> {
	const text = await response.text()
	try {
		const problem = JSON.parse(text) as { code?: string; detail?: string }
		return new PhoneProblemError(response.status, problem.code, problem.detail ?? text)
	} catch {
		return new PhoneProblemError(response.status, undefined, text)
	}
}

function bodyOf(request: PhoneRequest): FormData | string | undefined {
	if (request.form !== undefined) {
		return request.form
	}
	return request.body === undefined ? undefined : JSON.stringify(request.body)
}

// apps/vulna-mobile/src/api/client.ts, RFC 9449, ADR-013
export class SystemPhone {
	private nonce: string | undefined
	private sessionToken: string | undefined

	constructor(
		private readonly apiUrl: string,
		private readonly key: DeviceKey,
	) {}

	signIn(sessionToken: string): void {
		this.sessionToken = sessionToken
	}

	async call<T>(path: string, request: PhoneRequest = {}): Promise<T> {
		const response = await this.send(path, request)
		if (!response.ok) {
			throw await problemOf(response)
		}
		if (response.status === HTTP_NO_CONTENT) {
			return undefined as T
		}
		return (await response.json()) as T
	}

	private async send(path: string, request: PhoneRequest): Promise<Response> {
		const url = `${this.apiUrl}${API_BASE_PATH}${path}`
		const response = await this.sendOnce(url, request)
		return isNonceRequired(response) ? await this.sendOnce(url, request) : response
	}

	private async sendOnce(url: string, request: PhoneRequest): Promise<Response> {
		const method = request.method ?? "GET"
		const sessionToken = request.isDeviceOnly === true ? undefined : this.sessionToken
		const proof = this.key.proof({ method, url, nonce: this.nonce, sessionToken })
		const response = await fetch(url, {
			method,
			headers: {
				[ACCEPT_LANGUAGE_HEADER]: LANGUAGE,
				[APP_VERSION_HEADER]: APP_VERSION,
				[DPOP_HEADER]: proof,
				...(sessionToken === undefined ? {} : { [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${sessionToken}` }),
				...(request.body === undefined ? {} : { [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE }),
				...request.headers,
			},
			body: bodyOf(request),
		})
		const nonce = response.headers.get(DPOP_NONCE_HEADER)
		if (nonce !== null && nonce !== "") {
			this.nonce = nonce
		}
		return response
	}
}
