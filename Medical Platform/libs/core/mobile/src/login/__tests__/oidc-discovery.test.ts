import { describe, expect, it } from "vitest"
import { originAndPath, parseDiscoveryDocument, verifyAuthorizationUrl } from "../oidc-discovery"

const DISCOVERY_URL = "https://idp.example/application/o/vulna/.well-known/openid-configuration"
const ISSUER = "https://idp.example/application/o/vulna/"
const DISCOVERY = { issuer: ISSUER, authorizationEndpoint: "https://idp.example/application/o/authorize/" }
const AUTHORIZATION_URL = "https://idp.example/application/o/authorize/?client_id=x&state=s&prompt=login&max_age=0"

describe("authorization address against the provider's discovery", () => {
	it("accepts the address with the origin and path of the discovery endpoint, whatever the query", () => {
		expect(
			verifyAuthorizationUrl({ authorization_url: AUTHORIZATION_URL, issuer: ISSUER }, DISCOVERY, DISCOVERY_URL),
		).toEqual({ ok: true })
	})

	it("CAP-001-S36 refuses another origin or path and reports both endpoints for IT", () => {
		const verdict = verifyAuthorizationUrl(
			{ authorization_url: "https://evil.example/application/o/authorize/?state=s", issuer: ISSUER },
			DISCOVERY,
			DISCOVERY_URL,
		)
		expect(verdict).toEqual({
			ok: false,
			details: {
				server_authorization_endpoint: "https://evil.example/application/o/authorize/",
				provider_authorization_endpoint: "https://idp.example/application/o/authorize/",
				discovery_url: DISCOVERY_URL,
			},
		})
	})

	it("CAP-001-S36 refuses another issuer without naming the provider endpoint", () => {
		const verdict = verifyAuthorizationUrl(
			{ authorization_url: AUTHORIZATION_URL, issuer: "https://other.example/" },
			DISCOVERY,
			DISCOVERY_URL,
		)
		expect(verdict).toEqual({
			ok: false,
			details: {
				server_authorization_endpoint: "https://idp.example/application/o/authorize/",
				provider_authorization_endpoint: null,
				discovery_url: DISCOVERY_URL,
			},
		})
	})

	it("reads only the two members of the discovery document it needs", () => {
		expect(
			parseDiscoveryDocument({
				issuer: ISSUER,
				authorization_endpoint: DISCOVERY.authorizationEndpoint,
				jwks_uri: "x",
			}),
		).toEqual(DISCOVERY)
		expect(parseDiscoveryDocument({ issuer: ISSUER })).toBeUndefined()
		expect(parseDiscoveryDocument("nope")).toBeUndefined()
		expect(originAndPath("not a url")).toBeUndefined()
	})
})
