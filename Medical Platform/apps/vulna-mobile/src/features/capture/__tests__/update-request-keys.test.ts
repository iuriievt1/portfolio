import { afterEach, describe, expect, it } from "vitest"
import { forgetRequestKeys, requestKeyOf, settleRequestKey } from "../update-request-keys"

const ACQUISITION = "a0000000-0000-4000-8000-000000000001"

function keys() {
	let counter = 0
	return async () => {
		counter += 1
		return `key-${counter}`
	}
}

afterEach(() => forgetRequestKeys())

describe("request key of a draft update", () => {
	it("CAP-021-S24 repeats the key of an unanswered update with the same content", async () => {
		const newKey = keys()
		const first = await requestKeyOf(ACQUISITION, '{"finding_id":"f"}', newKey)
		expect(await requestKeyOf(ACQUISITION, '{"finding_id":"f"}', newKey)).toBe(first)
	})

	it("CAP-021-R29 gives a changed update a new key", async () => {
		const newKey = keys()
		const first = await requestKeyOf(ACQUISITION, '{"finding_id":"f"}', newKey)
		expect(await requestKeyOf(ACQUISITION, '{"finding_id":"g"}', newKey)).not.toBe(first)
	})

	it("CAP-021-S23 gives a new key once the update was answered", async () => {
		const newKey = keys()
		const first = await requestKeyOf(ACQUISITION, '{"finding_id":"f"}', newKey)
		settleRequestKey(ACQUISITION)
		expect(await requestKeyOf(ACQUISITION, '{"finding_id":"f"}', newKey)).not.toBe(first)
	})
})
