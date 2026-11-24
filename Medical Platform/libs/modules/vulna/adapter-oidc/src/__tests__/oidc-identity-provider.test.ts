import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto"
import { IDENTITY_PROVIDER_FAILURE } from "@ansora/core-server/ports"
import { describe, expect, it } from "vitest"
import { DEFAULT_SCOPES, OidcIdentityProvider, scopeParameter } from "../index"

const ISSUER = "https://idp.example/application/o/vulna/"
const CLIENT_ID = "ansora-vulna-server"
const CLIENT_SECRET = "s3cret"
const REDIRECT_URI = "https://vulna.example/api/v1/login/oidc/return"
const KID = "key-1"
const NOW_SECONDS = Math.floor(Date.now() / 1000)

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 })

const METADATA = {
	issuer: ISSUER,
	authorization_endpoint: "https://idp.example/application/o/authorize/",
	token_endpoint: "https://idp.example/application/o/token/",
	jwks_uri: "https://idp.example/application/o/vulna/jwks/",
}

function idToken(
	key: KeyObject,
	claims: Record<string, unknown>,
	header: Record<string, unknown> = { alg: "RS256", kid: KID },
): string {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
	const input = `${encode(header)}.${encode(claims)}`
	const signature = createSign("sha256").update(input).sign(key)
	return `${input}.${signature.toString("base64url")}`
}

function standardClaims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		iss: ISSUER,
		sub: "subject-1",
		aud: CLIENT_ID,
		exp: NOW_SECONDS + 300,
		iat: NOW_SECONDS,
		auth_time: NOW_SECONDS,
		nonce: "nonce-1",
		name: "Jana Nováková",
		given_name: "Jana",
		family_name: "Nováková",
		personal_number: "000101",
		groups: ["vulna-clinicians"],
		...overrides,
	}
}

interface FakeProvider {
	fetch: typeof fetch
	tokenRequests: { headers: Record<string, string>; form: URLSearchParams }[]
}

function fakeProvider(tokenResponse: (form: URLSearchParams) => Response): FakeProvider {
	const tokenRequests: FakeProvider["tokenRequests"] = []
	const jwk = publicKey.export({ format: "jwk" })
	const fetchFake: typeof fetch = async (input, init) => {
		const url = String(input)
		if (url === `${ISSUER.replace(/\/$/, "")}/.well-known/openid-configuration`) {
			return Response.json(METADATA)
		}
		if (url === METADATA.jwks_uri) {
			return Response.json({ keys: [{ ...jwk, kid: KID, use: "sig", alg: "RS256" }] })
		}
		if (url === METADATA.token_endpoint) {
			const form = new URLSearchParams(String(init?.body))
			tokenRequests.push({ headers: { ...(init?.headers as Record<string, string>) }, form })
			return tokenResponse(form)
		}
		throw new Error(`unexpected request ${url}`)
	}
	return { fetch: fetchFake, tokenRequests }
}

function providerWith(fake: FakeProvider): OidcIdentityProvider {
	return new OidcIdentityProvider({
		issuer: ISSUER,
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		redirectUri: REDIRECT_URI,
		fetch: fake.fetch,
	})
}

describe("OIDC adapter of the IdentityProvider port", () => {
	it("CAP-001-R26 builds an authorization URL with PKCE, prompt=login and max_age=0", async () => {
		const provider = providerWith(fakeProvider(() => Response.json({})))
		const url = new URL(await provider.authorizationUrl({ state: "st", nonce: "no", codeChallenge: "ch" }))
		expect(`${url.origin}${url.pathname}`).toBe(METADATA.authorization_endpoint)
		expect(Object.fromEntries(url.searchParams)).toMatchObject({
			response_type: "code",
			client_id: CLIENT_ID,
			redirect_uri: REDIRECT_URI,
			state: "st",
			nonce: "no",
			code_challenge: "ch",
			code_challenge_method: "S256",
			prompt: "login",
			max_age: "0",
		})
		expect(url.searchParams.get("scope")).toBe(DEFAULT_SCOPES)
		expect(provider.issuer()).toBe(ISSUER)
	})

	it("NAB-224 requests offline_access by default and the scopes of the deployment when configured", async () => {
		expect(DEFAULT_SCOPES.split(" ")).toContain("offline_access")
		const fake = fakeProvider(() => Response.json({}))
		const provider = new OidcIdentityProvider({
			issuer: ISSUER,
			clientId: CLIENT_ID,
			clientSecret: CLIENT_SECRET,
			redirectUri: REDIRECT_URI,
			scopes: "openid  profile personal_number groups openid",
			fetch: fake.fetch,
		})
		const url = new URL(await provider.authorizationUrl({ state: "st", nonce: "no", codeChallenge: "ch" }))
		expect(url.searchParams.get("scope")).toBe("openid profile personal_number groups")
		expect(() => scopeParameter("profile email")).toThrow(/openid/)
		expect(() => scopeParameter(" ")).toThrow(/openid/)
	})

	it("CAP-001-R04 exchanges the code as a confidential client and returns the identity of a verified ID token", async () => {
		const fake = fakeProvider(() =>
			Response.json({ id_token: idToken(privateKey, standardClaims()), refresh_token: "rt-1" }),
		)
		const outcome = await providerWith(fake).exchangeCode({
			code: "code-1",
			codeVerifier: "verifier",
			nonce: "nonce-1",
		})
		expect(outcome.ok).toBe(true)
		if (!outcome.ok) {
			return
		}
		expect(outcome.identity).toMatchObject({
			subjectId: "subject-1",
			displayName: "Jana Nováková",
			givenName: "Jana",
			familyName: "Nováková",
			authTime: NOW_SECONDS,
			refreshToken: "rt-1",
		})
		expect(outcome.identity.claims.personal_number).toBe("000101")
		const [request] = fake.tokenRequests
		expect(request?.form.get("grant_type")).toBe("authorization_code")
		expect(request?.form.get("code_verifier")).toBe("verifier")
		expect(request?.form.get("redirect_uri")).toBe(REDIRECT_URI)
		expect(request?.headers.authorization).toBe(
			`Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
		)
	})

	it.each([
		["another nonce", standardClaims({ nonce: "other" })],
		["another audience", standardClaims({ aud: "someone-else" })],
		["another issuer", standardClaims({ iss: "https://evil.example/" })],
		["an expired token", standardClaims({ exp: NOW_SECONDS - 120 })],
	])("rejects an ID token with %s", async (_name, claims) => {
		const fake = fakeProvider(() => Response.json({ id_token: idToken(privateKey, claims) }))
		const outcome = await providerWith(fake).exchangeCode({ code: "c", codeVerifier: "v", nonce: "nonce-1" })
		expect(outcome).toMatchObject({ ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED })
	})

	it("rejects an ID token signed by a key the provider does not publish", async () => {
		const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
		const fake = fakeProvider(() => Response.json({ id_token: idToken(other, standardClaims()) }))
		const outcome = await providerWith(fake).exchangeCode({ code: "c", codeVerifier: "v", nonce: "nonce-1" })
		expect(outcome).toMatchObject({ ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED })
	})

	it("CAP-001-S10 reports an unreachable provider as unavailable, a refused code as rejected", async () => {
		const down = fakeProvider(() => {
			throw new TypeError("fetch failed")
		})
		expect(await providerWith(down).exchangeCode({ code: "c", codeVerifier: "v", nonce: "n" })).toMatchObject({
			ok: false,
			failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE,
		})
		const refusing = fakeProvider(() => Response.json({ error: "invalid_grant" }, { status: 400 }))
		expect(await providerWith(refusing).exchangeCode({ code: "c", codeVerifier: "v", nonce: "n" })).toMatchObject({
			ok: false,
			failure: IDENTITY_PROVIDER_FAILURE.REJECTED,
			detail: "invalid_grant",
		})
	})

	it("NAB-224 refreshes the provider token and returns the rotated token with a fresh identity", async () => {
		const fake = fakeProvider((form) =>
			form.get("grant_type") === "refresh_token"
				? Response.json({
						id_token: idToken(privateKey, standardClaims({ nonce: undefined, groups: [] })),
						refresh_token: "rt-2",
					})
				: Response.json({}, { status: 400 }),
		)
		const outcome = await providerWith(fake).refresh("rt-1")
		expect(outcome.ok).toBe(true)
		if (!outcome.ok) {
			return
		}
		expect(outcome.refreshed.refreshToken).toBe("rt-2")
		expect(outcome.refreshed.identity?.claims.groups).toEqual([])
		expect(fake.tokenRequests[0]?.form.get("refresh_token")).toBe("rt-1")
	})

	it("NAB-225 reports a refused refresh token as rejected", async () => {
		const fake = fakeProvider(() =>
			Response.json({ error: "invalid_grant", error_description: "revoked" }, { status: 400 }),
		)
		expect(await providerWith(fake).refresh("rt-1")).toMatchObject({
			ok: false,
			failure: IDENTITY_PROVIDER_FAILURE.REJECTED,
		})
	})
})
