import { ACQUISITION_KIND, MISSING_STEP } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	type ClinicalSteps,
	type DraftProgress,
	isReminderDue,
	missingStepsOf,
	nextMissingStepOf,
} from "../entities/acquisition"

const NO_UNFINISHED_FILES = 0
const ONE_UNFINISHED_FILE = 1
const ALL_STEPS: ClinicalSteps = { woundType: true, healingPhase: true }
const LOCATION_ONLY: ClinicalSteps = { woundType: false, healingPhase: false }

const photo: DraftProgress = {
	kind: ACQUISITION_KIND.PHOTO,
	fileCount: 0,
	hasFinding: false,
	hasBodySite: false,
	hasWoundType: false,
	hasHealingPhase: false,
	hasDocumentTitle: false,
}

const completePhoto: DraftProgress = {
	...photo,
	fileCount: 2,
	hasFinding: true,
	hasBodySite: true,
	hasWoundType: true,
	hasHealingPhase: true,
}

const scan: DraftProgress = { ...photo, kind: ACQUISITION_KIND.SCAN }

// CAP-014-R22, CAP-015-R31
describe("what a draft still misses before it can be closed", () => {
	it("walks the wound flow in the order of the bedside", () => {
		expect(nextMissingStepOf(photo, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(MISSING_STEP.IMAGES)
		expect(nextMissingStepOf({ ...photo, fileCount: 2 }, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(MISSING_STEP.FINDING)
		expect(nextMissingStepOf({ ...completePhoto, hasBodySite: false }, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(
			MISSING_STEP.BODY_SITE,
		)
		expect(nextMissingStepOf({ ...completePhoto, hasWoundType: false }, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(
			MISSING_STEP.WOUND_TYPE,
		)
		expect(nextMissingStepOf({ ...completePhoto, hasHealingPhase: false }, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(
			MISSING_STEP.HEALING_PHASE,
		)
		expect(nextMissingStepOf(completePhoto, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(MISSING_STEP.SUMMARY)
	})

	it("walks the document flow: pages, title, summary", () => {
		expect(nextMissingStepOf(scan, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(MISSING_STEP.PAGES)
		expect(nextMissingStepOf({ ...scan, fileCount: 1 }, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(
			MISSING_STEP.DOCUMENT_TITLE,
		)
		expect(nextMissingStepOf({ ...scan, fileCount: 1, hasDocumentTitle: true }, ALL_STEPS, NO_UNFINISHED_FILES)).toBe(
			MISSING_STEP.SUMMARY,
		)
	})

	it("CAP-015-R35 CAP-015-R36 asks for the files when only unfinished files keep the record open", () => {
		expect(nextMissingStepOf(completePhoto, ALL_STEPS, ONE_UNFINISHED_FILE)).toBe(MISSING_STEP.FILES)
		expect(nextMissingStepOf({ ...completePhoto, hasHealingPhase: false }, ALL_STEPS, ONE_UNFINISHED_FILE)).toBe(
			MISSING_STEP.HEALING_PHASE,
		)
	})
})

// CAP-021-R22
describe("steps missing to close a record", () => {
	it("lets a complete photo record close", () => {
		expect(missingStepsOf(completePhoto, ALL_STEPS)).toEqual([])
	})

	it("CAP-015-S48 names the missing finding, location and healing phase", () => {
		expect(missingStepsOf({ ...photo, fileCount: 2 }, ALL_STEPS)).toEqual([
			MISSING_STEP.FINDING,
			MISSING_STEP.BODY_SITE,
			MISSING_STEP.HEALING_PHASE,
		])
	})

	it("CAP-017-R02 names the wound type missing on the finding", () => {
		expect(missingStepsOf({ ...completePhoto, hasWoundType: false }, ALL_STEPS)).toEqual([MISSING_STEP.WOUND_TYPE])
	})

	it("CAP-018-R15 names the missing document title of a scan", () => {
		expect(missingStepsOf({ ...completePhoto, kind: ACQUISITION_KIND.SCAN }, ALL_STEPS)).toEqual([
			MISSING_STEP.DOCUMENT_TITLE,
		])
	})

	it("names the missing pages of an empty scan", () => {
		expect(missingStepsOf({ ...scan, hasDocumentTitle: true }, ALL_STEPS)).toEqual([MISSING_STEP.PAGES])
	})

	it("CAP-017-S16 does not ask for the wound type or the healing phase the instance switched off", () => {
		const located = { ...completePhoto, hasWoundType: false, hasHealingPhase: false }

		expect(missingStepsOf(located, LOCATION_ONLY)).toEqual([])
		expect(nextMissingStepOf(located, LOCATION_ONLY, NO_UNFINISHED_FILES)).toBe(MISSING_STEP.SUMMARY)
		expect(missingStepsOf({ ...photo, fileCount: 2 }, LOCATION_ONLY)).toEqual([
			MISSING_STEP.FINDING,
			MISSING_STEP.BODY_SITE,
		])
	})

	it("is the list whose first step the draft shows next", () => {
		const partial = { ...completePhoto, hasBodySite: false, hasHealingPhase: false }

		expect(missingStepsOf(partial, ALL_STEPS)[0]).toBe(nextMissingStepOf(partial, ALL_STEPS, NO_UNFINISHED_FILES))
	})
})

// CAP-012-R31, CAP-015-R18
describe("reminder of a forgotten draft", () => {
	const updatedAt = new Date("2026-10-07T10:00:00Z")

	it("is due once the configured time without a change has passed", () => {
		expect(isReminderDue(updatedAt, new Date("2026-10-07T10:00:59Z"), 60)).toBe(false)
		expect(isReminderDue(updatedAt, new Date("2026-10-07T10:01:00Z"), 60)).toBe(true)
	})
})
