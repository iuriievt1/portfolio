import { ERROR_CODE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { CodedError, codeOf } from "../../__tests__/coded-error"
import { createDeviceTokenCaller, type DeviceTokenState, NoDeviceTokenError } from "../device-token-caller"

const NOW = Date.parse("2026-10-14T08:00:00Z")
const MINUTE_MS = 60_000
const FIRST_TOKEN = "first-token"
const SECOND_TOKEN = "second-token"

function stateOf(token: string, expiresInMs: number): DeviceTokenState {
	return { device_token: token, device_token_expires_at: new Date(NOW + expiresInMs).toISOString() }
}

function api(states: DeviceTokenState[]) {
	const fake = {
		verifications: 0,
		verifyDevice: async () => {
			const state = states[fake.verifications] ?? states.at(-1)
			fake.verifications += 1
			if (state === undefined) {
				throw new Error("no device state")
			}
			return state
		},
	}
	return fake
}

async function echo(token: string): Promise<string> {
	return token
}

describe("createDeviceTokenCaller CAP-002-R09", () => {
	it("CAP-002-S24 issues the token by verifying the device and keeps it while it is valid", async () => {
		const server = api([stateOf(FIRST_TOKEN, 15 * MINUTE_MS)])
		const caller = createDeviceTokenCaller(server, codeOf, () => NOW)

		expect(await caller.call(echo)).toBe(FIRST_TOKEN)
		expect(await caller.call(echo)).toBe(FIRST_TOKEN)
		expect(server.verifications).toBe(1)
	})

	it("renews the token before it runs out", async () => {
		const server = api([stateOf(FIRST_TOKEN, MINUTE_MS / 2), stateOf(SECOND_TOKEN, 15 * MINUTE_MS)])
		const caller = createDeviceTokenCaller(server, codeOf, () => NOW)

		await caller.call(echo)

		expect(await caller.call(echo)).toBe(SECOND_TOKEN)
		expect(server.verifications).toBe(2)
	})

	it("CAP-019-S05 verifies the device again after the server refused the token and repeats the call", async () => {
		const server = api([stateOf(FIRST_TOKEN, 15 * MINUTE_MS), stateOf(SECOND_TOKEN, 15 * MINUTE_MS)])
		const caller = createDeviceTokenCaller(server, codeOf, () => NOW)
		const used: string[] = []

		const result = await caller.call(async (token) => {
			used.push(token)
			if (token === FIRST_TOKEN) {
				throw new CodedError(ERROR_CODE.SIGN_IN_AGAIN)
			}
			return "done"
		})

		expect(result).toBe("done")
		expect(used).toEqual([FIRST_TOKEN, SECOND_TOKEN])
	})

	it("passes any other refusal on without verifying the device again", async () => {
		const server = api([stateOf(FIRST_TOKEN, 15 * MINUTE_MS)])
		const caller = createDeviceTokenCaller(server, codeOf, () => NOW)

		const failure = caller.call(async () => {
			throw new CodedError(ERROR_CODE.RECORD_REJECTED)
		})

		await expect(failure).rejects.toMatchObject({ code: ERROR_CODE.RECORD_REJECTED })
		expect(server.verifications).toBe(1)
	})

	it("refuses to call without a token from a device that is not approved", async () => {
		const caller = createDeviceTokenCaller(api([{}]), codeOf, () => NOW)

		await expect(caller.call(echo)).rejects.toBeInstanceOf(NoDeviceTokenError)
	})

	it("verifies the device once for calls that start together", async () => {
		const server = api([stateOf(FIRST_TOKEN, 15 * MINUTE_MS)])
		const caller = createDeviceTokenCaller(server, codeOf, () => NOW)

		const tokens = await Promise.all([caller.call(echo), caller.call(echo)])

		expect(tokens).toEqual([FIRST_TOKEN, FIRST_TOKEN])
		expect(server.verifications).toBe(1)
	})
})
