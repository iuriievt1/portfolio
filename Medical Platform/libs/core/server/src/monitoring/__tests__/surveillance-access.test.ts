import { describe, expect, it } from "vitest"
import {
	SURVEILLANCE_ACCESS,
	surveillanceAccessOf,
	surveillanceRefusalOf,
	surveillanceTokenOf,
} from "../surveillance-access"

const TOKEN = "f3b1c2d4e5f6a7b8c9d0e1f2a3b4c5d6"

describe("surveillanceAccessOf", () => {
	it("CAP-028-R08 grants the details to the monitoring system that presents the token", () => {
		expect(surveillanceAccessOf({ authorization: `Bearer ${TOKEN}`, isReservedInterface: false }, TOKEN)).toBe(
			SURVEILLANCE_ACCESS.GRANTED,
		)
	})

	it("RFC 7235 takes the scheme name in any letter case", () => {
		expect(surveillanceAccessOf({ authorization: `bearer ${TOKEN}`, isReservedInterface: false }, TOKEN)).toBe(
			SURVEILLANCE_ACCESS.GRANTED,
		)
	})

	it("CAP-028-S05 refuses a client without the token or with another one", () => {
		expect(surveillanceAccessOf({ authorization: undefined, isReservedInterface: false }, TOKEN)).toBe(
			SURVEILLANCE_ACCESS.UNAUTHENTICATED,
		)
		expect(surveillanceAccessOf({ authorization: "Bearer wrong", isReservedInterface: true }, TOKEN)).toBe(
			SURVEILLANCE_ACCESS.UNAUTHENTICATED,
		)
		expect(surveillanceAccessOf({ authorization: TOKEN, isReservedInterface: false }, TOKEN)).toBe(
			SURVEILLANCE_ACCESS.UNAUTHENTICATED,
		)
	})

	it("CAP-028-R08 grants the details on the reserved interface when the installation chose it", () => {
		expect(surveillanceAccessOf({ authorization: undefined, isReservedInterface: true }, undefined)).toBe(
			SURVEILLANCE_ACCESS.GRANTED,
		)
	})

	it("CAP-028-S05 does not expose the details anywhere else without a token", () => {
		expect(surveillanceAccessOf({ authorization: `Bearer ${TOKEN}`, isReservedInterface: false }, undefined)).toBe(
			SURVEILLANCE_ACCESS.NOT_EXPOSED,
		)
	})

	it("refuses to start with a token too short to keep the details private", () => {
		expect(surveillanceTokenOf(undefined)).toBeUndefined()
		expect(surveillanceTokenOf(TOKEN)).toBe(TOKEN)
		expect(() => surveillanceTokenOf("short")).toThrow()
	})

	it("CAP-028-S05 answers a refused client with a bare status and nothing else", () => {
		expect(surveillanceRefusalOf(SURVEILLANCE_ACCESS.GRANTED)).toBeUndefined()
		expect(surveillanceRefusalOf(SURVEILLANCE_ACCESS.UNAUTHENTICATED)).toEqual({
			status: 401,
			headers: { "WWW-Authenticate": "Bearer" },
		})
		expect(surveillanceRefusalOf(SURVEILLANCE_ACCESS.NOT_EXPOSED)).toEqual({ status: 404, headers: {} })
	})
})
