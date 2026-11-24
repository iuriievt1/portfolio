import { describe, expect, it } from "vitest"
import { encounterIdOfKey, requestedEncounterIdOf } from "../utils/encounter-identity"

const KEY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

// CAP-014-R06, ADR-050 bod 10
describe("identifier of a visit created in the app", () => {
	it("is the same for the same key from the device, so a repeated request writes the same visit", () => {
		expect(encounterIdOfKey(KEY)).toBe(encounterIdOfKey(KEY.toUpperCase()))
		expect(encounterIdOfKey(KEY)).not.toBe(encounterIdOfKey("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"))
	})

	it("is a name-based UUID that does not repeat the key", () => {
		const id = encounterIdOfKey(KEY)
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
		expect(id).not.toBe(KEY)
	})

	it("keeps the identifier a visit already got from its key", () => {
		expect(encounterIdOfKey(KEY)).toBe("58669abc-7356-5b72-999f-c9b1468916a4")
	})

	it("names an existing visit by its id and a new one by its key", () => {
		const id = "88888888-8888-4888-8888-888888888888"
		expect(requestedEncounterIdOf({ encounter_id: id })).toBe(id)
		expect(requestedEncounterIdOf({ encounter_key: KEY })).toBe(encounterIdOfKey(KEY))
		expect(() => requestedEncounterIdOf({})).toThrow()
	})
})
