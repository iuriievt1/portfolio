import { describe, expect, it } from "vitest"
import { acquisitionAssignmentSchema, acquisitionVersionSchema } from "../dto/acquisition-assignment.input.dto"

const PATIENT = "55555555-5555-4555-8555-555555555555"
const ENCOUNTER = "88888888-8888-4888-8888-888888888888"
const ENCOUNTER_KEY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd"

describe("assignment of a draft clinical-workflow.yaml AcquisitionAssignment", () => {
	it("CAP-014-R06 accepts an existing visit or a new one by its key", () => {
		expect(acquisitionAssignmentSchema.safeParse({ patient_id: PATIENT, encounter_id: ENCOUNTER }).success).toBe(true)
		expect(acquisitionAssignmentSchema.safeParse({ patient_id: PATIENT, encounter_key: ENCOUNTER_KEY }).success).toBe(
			true,
		)
	})

	it("CAP-014-R06 refuses both visit references or none", () => {
		const both = { patient_id: PATIENT, encounter_id: ENCOUNTER, encounter_key: ENCOUNTER_KEY }
		expect(acquisitionAssignmentSchema.safeParse(both).success).toBe(false)
		expect(acquisitionAssignmentSchema.safeParse({ patient_id: PATIENT }).success).toBe(false)
	})

	it("CAP-014-R06 reads the key of a new visit in lowercase", () => {
		const assignment = acquisitionAssignmentSchema.parse({
			patient_id: PATIENT,
			encounter_key: ENCOUNTER_KEY.toUpperCase(),
		})
		expect(assignment.encounter_key).toBe(ENCOUNTER_KEY)
	})
})

describe("version of a draft index.yaml AcquisitionVersion", () => {
	it("CAP-021-R32 reads the strong ETag", () => {
		expect(acquisitionVersionSchema.parse('"7"')).toBe(7)
	})

	it("CAP-021-R32 refuses a version without quotes or a missing one", () => {
		expect(acquisitionVersionSchema.safeParse("7").success).toBe(false)
		expect(acquisitionVersionSchema.safeParse('"0"').success).toBe(false)
		expect(acquisitionVersionSchema.safeParse(undefined).success).toBe(false)
	})
})
