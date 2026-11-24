import { DEPENDENCY_STATE } from "@ansora/contracts"
import {
	DependencyObservation,
	IDENTITY_PROVIDER_FAILURE,
	type IdentityOutcome,
	type IdentityProviderPort,
	type RefreshOutcome,
} from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { ObservedIdentityProvider } from "../observed-identity-provider"

const ISSUER = "https://idp.hospital.example"
const AUTHORIZATION_URL = `${ISSUER}/authorize`
const CODE_EXCHANGE = { code: "code", codeVerifier: "verifier", nonce: "nonce" }
const AUTHORIZATION_REQUEST = { state: "state", nonce: "nonce", codeChallenge: "challenge" }

const UNAVAILABLE: IdentityOutcome = {
	ok: false,
	failure: IDENTITY_PROVIDER_FAILURE.UNAVAILABLE,
	detail: "connect ECONNREFUSED",
}
const REJECTED: IdentityOutcome = { ok: false, failure: IDENTITY_PROVIDER_FAILURE.REJECTED, detail: "invalid_grant" }
const REFRESHED: RefreshOutcome = { ok: true, refreshed: { refreshToken: undefined, identity: undefined } }

function observedWith(provider: Partial<IdentityProviderPort>) {
	const observation = new DependencyObservation()
	const observed = new ObservedIdentityProvider(
		{ issuer: () => ISSUER, ...provider } as IdentityProviderPort,
		observation,
	)
	return { observed, observation }
}

describe("ObservedIdentityProvider", () => {
	it("CAP-028-R05 sees the provider unavailable when its discovery fails", async () => {
		const { observed, observation } = observedWith({
			authorizationUrl: async () => {
				throw new Error("discovery failed")
			},
		})

		await expect(observed.authorizationUrl(AUTHORIZATION_REQUEST)).rejects.toThrow("discovery failed")
		expect(observation.state()).toBe(DEPENDENCY_STATE.UNAVAILABLE)
	})

	it("leaves the state as it was when the authorization address comes from the cached discovery", async () => {
		const { observed, observation } = observedWith({ authorizationUrl: async () => AUTHORIZATION_URL })

		expect(await observed.authorizationUrl(AUTHORIZATION_REQUEST)).toBe(AUTHORIZATION_URL)
		expect(observation.state()).toBe(DEPENDENCY_STATE.UNKNOWN)
	})

	it("CAP-028-R05 sees the provider unavailable when the code exchange cannot reach it", async () => {
		const { observed, observation } = observedWith({ exchangeCode: async () => UNAVAILABLE })

		expect(await observed.exchangeCode(CODE_EXCHANGE)).toBe(UNAVAILABLE)
		expect(observation.state()).toBe(DEPENDENCY_STATE.UNAVAILABLE)
	})

	it("counts a rejected code as an answer of the provider", async () => {
		const { observed, observation } = observedWith({ exchangeCode: async () => REJECTED })
		observation.recordUnavailability(Date.now())

		expect(await observed.exchangeCode(CODE_EXCHANGE)).toBe(REJECTED)
		expect(observation.state()).toBe(DEPENDENCY_STATE.AVAILABLE)
	})

	it("counts a refreshed session as an answer of the provider", async () => {
		const { observed, observation } = observedWith({ refresh: async () => REFRESHED })

		expect(await observed.refresh("refresh-token")).toBe(REFRESHED)
		expect(observation.state()).toBe(DEPENDENCY_STATE.AVAILABLE)
		expect(observed.issuer()).toBe(ISSUER)
	})
})
