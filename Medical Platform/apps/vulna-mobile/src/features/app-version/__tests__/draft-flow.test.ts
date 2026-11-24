import { describe, expect, it } from "vitest"
import { isInDraftFlow, leavesForUpdateScreen } from "../draft-flow"

const HOME = ["(protected)", "overview"]
const PHOTO_LOCATION = ["(protected)", "visit", "[id]", "capture", "location"]
const SCAN = ["(protected)", "visit", "[id]", "scan"]
const VISIT = ["(protected)", "visit", "[id]"]
const PATIENT = ["(protected)", "patient", "[id]"]
const SETTINGS = ["(protected)", "settings"]

describe("screens after the server rejected the app version CAP-012-R25", () => {
	it("knows the steps of a started photo or scan record", () => {
		expect(isInDraftFlow(PHOTO_LOCATION)).toBe(true)
		expect(isInDraftFlow(SCAN)).toBe(true)
		expect(isInDraftFlow(VISIT)).toBe(false)
		expect(isInDraftFlow(PATIENT)).toBe(false)
	})

	it("CAP-012-S30 leaves the nurse in a started record and on the update screen", () => {
		expect(leavesForUpdateScreen(PHOTO_LOCATION)).toBe(false)
		expect(leavesForUpdateScreen(SCAN)).toBe(false)
		expect(leavesForUpdateScreen(HOME)).toBe(false)
	})

	it("CAP-012-S16 takes the nurse from any other screen to the update screen", () => {
		expect(leavesForUpdateScreen(VISIT)).toBe(true)
		expect(leavesForUpdateScreen(PATIENT)).toBe(true)
		expect(leavesForUpdateScreen(SETTINGS)).toBe(true)
	})
})
