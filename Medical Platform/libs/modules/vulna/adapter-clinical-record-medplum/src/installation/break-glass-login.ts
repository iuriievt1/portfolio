import { createHash, randomBytes } from "node:crypto"
import type { Fetch } from "../timed-fetch"

export interface BreakGlassCredentials {
	email: string
	password: string
}

const LOGIN_PATH = "auth/login"
const TOKEN_PATH = "oauth2/token"
const CODE_CHALLENGE_METHOD = "S256"
const VERIFIER_BYTES = 32
const OPENID_SCOPE = "openid"
const AUTHORIZATION_CODE_GRANT = "authorization_code"

interface LoginResponse {
	code?: string
}

interface TokenResponse {
	access_token?: string
}

// ADR-050 bod 10, PKCE S256
export async function breakGlassAccessToken(
	baseUrl: string,
	credentials: BreakGlassCredentials,
	fetchStore: Fetch,
): Promise<string> {
	const verifier = randomBytes(VERIFIER_BYTES).toString("base64url")
	const challenge = createHash("sha256").update(verifier).digest("base64url")
	const login = await fetchStore(new URL(LOGIN_PATH, baseUrl), {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			email: credentials.email,
			password: credentials.password,
			scope: OPENID_SCOPE,
			codeChallenge: challenge,
			codeChallengeMethod: CODE_CHALLENGE_METHOD,
		}),
	})
	const { code } = (await login.json()) as LoginResponse
	if (!login.ok || code === undefined) {
		throw new Error(`the store refused the break-glass login with ${login.status}`)
	}
	const token = await fetchStore(new URL(TOKEN_PATH, baseUrl), {
		method: "POST",
		body: new URLSearchParams({ grant_type: AUTHORIZATION_CODE_GRANT, code, code_verifier: verifier }),
	})
	const { access_token: accessToken } = (await token.json()) as TokenResponse
	if (!token.ok || accessToken === undefined) {
		throw new Error(`the store issued no token for the break-glass login: ${token.status}`)
	}
	return accessToken
}
