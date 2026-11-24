import { IDENTITY_PROVIDER_FAILURE, type IdentityProviderFailure } from "@ansora/core-server/ports"
import type { Fetch } from "./discovery"
import { JSON_MEDIA_TYPE, messageOf, optionalText } from "./text"

export interface TokenResponse {
	id_token: string | undefined
	refresh_token: string | undefined
}

export type TokenEndpointOutcome =
	| { ok: true; response: TokenResponse }
	| { ok: false; failure: IdentityProviderFailure; detail: string }

const SERVER_ERROR = 500
const FORM_MEDIA_TYPE = "application/x-www-form-urlencoded"

export class TokenEndpoint {
	constructor(
		private readonly clientId: string,
		private readonly clientSecret: string,
		private readonly fetchImplementation: Fetch,
	) {}

	async exchange(tokenEndpoint: string, form: Record<string, string>): Promise<TokenEndpointOutcome> {
		let response: Response
		try {
			response = await this.fetchImplementation(tokenEndpoint, {
				method: "POST",
				headers: {
					authorization: `Basic ${basicCredentials(this.clientId, this.clientSecret)}`,
					"content-type": FORM_MEDIA_TYPE,
					accept: JSON_MEDIA_TYPE,
				},
				body: new URLSearchParams(form).toString(),
			})
		} catch (error) {
			return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE, detail: messageOf(error) }
		}
		if (response.status >= SERVER_ERROR) {
			return {
				ok: false,
				failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE,
				detail: `token endpoint answered ${response.status}`,
			}
		}
		const body = await bodyOf(response)
		if (!response.ok) {
			return { ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED, detail: errorOf(body, response.status) }
		}
		return {
			ok: true,
			response: {
				id_token: optionalText(body.id_token),
				refresh_token: optionalText(body.refresh_token),
			},
		}
	}
}

function basicCredentials(clientId: string, clientSecret: string): string {
	return Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64")
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
	try {
		const body: unknown = await response.json()
		return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {}
	} catch {
		return {}
	}
}

function errorOf(body: Record<string, unknown>, status: number): string {
	const code = optionalText(body.error) ?? `status ${status}`
	const description = optionalText(body.error_description)
	return description === undefined ? code : `${code}: ${description}`
}
