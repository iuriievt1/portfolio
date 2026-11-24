import { describe, expect, it } from "vitest"
import { READ_TIMEOUT_MILLISECONDS, REQUEST_TIMEOUT_MILLISECONDS, readTimeoutOf } from "../timed-fetch"

const BASE_URL = "http://store.invalid/"

describe("time limit of a history read", () => {
	it("backend.md 3.1 keeps the read limit for every FHIR read", () => {
		expect(readTimeoutOf(`${BASE_URL}fhir/R4/Observation?_count=200`, BASE_URL)).toBe(READ_TIMEOUT_MILLISECONDS)
		expect(readTimeoutOf(`${BASE_URL}fhir/R4/`, BASE_URL)).toBe(READ_TIMEOUT_MILLISECONDS)
	})

	it("CAP-020-R16 does not hold the sign-in to the store to the read limit", () => {
		expect(readTimeoutOf(`${BASE_URL}oauth2/token`, BASE_URL)).toBe(REQUEST_TIMEOUT_MILLISECONDS)
		expect(readTimeoutOf(`${BASE_URL}auth/me`, BASE_URL)).toBe(REQUEST_TIMEOUT_MILLISECONDS)
		expect(readTimeoutOf("http://store.invalid/oauth2/token", "http://store.invalid")).toBe(
			REQUEST_TIMEOUT_MILLISECONDS,
		)
	})

	it("reads a FHIR resource that only looks like a sign-in path under the read limit", () => {
		expect(readTimeoutOf(`${BASE_URL}fhir/R4/Observation/auth`, BASE_URL)).toBe(READ_TIMEOUT_MILLISECONDS)
		expect(readTimeoutOf("http://other.invalid/oauth2/token", BASE_URL)).toBe(READ_TIMEOUT_MILLISECONDS)
	})
})
