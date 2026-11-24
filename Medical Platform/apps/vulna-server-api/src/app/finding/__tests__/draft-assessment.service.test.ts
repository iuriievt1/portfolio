import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import type { DraftAssessmentRecord } from "../../clinical-record/types/clinical-record.types"
import type { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import { DEPARTMENT, PATIENT } from "../../encounter/__tests__/encounter-fixtures"
import type { AssessmentRepository } from "../repositories/assessment.repository"
import type { BodySiteRepository } from "../repositories/body-site.repository"
import type { FindingRepository } from "../repositories/finding.repository"
import { DraftAssessmentService } from "../services/draft-assessment.service"
import type { AssessmentChoice, AssessmentRow, LocatedDraft, StoredAssessment } from "../types/finding.types"

const TX = {} as postgres.TransactionSql
const NOW = new Date("2026-10-08T10:00:00Z")
const DRAFT_ID = "a0000000-0000-4000-8000-000000000001"
const FINDING_ID = "d0000000-0000-4000-8000-000000000001"
const DRAFT: LocatedDraft = { id: DRAFT_ID, patient_id: PATIENT, department_id: DEPARTMENT, finding_id: FINDING_ID }

function harness(before: AssessmentRow | undefined = undefined) {
	const stored: StoredAssessment[] = []
	const recorded: DraftAssessmentRecord[] = []
	const withdrawn: DraftAssessmentRecord[] = []
	const removed: string[] = []
	const assessments = {
		findByAcquisition: async () => before,
		upsert: async (_tx: never, assessment: StoredAssessment) => {
			stored.push(assessment)
		},
		remove: async (_tx: never, acquisitionId: string) => {
			removed.push(acquisitionId)
		},
	} as unknown as AssessmentRepository
	const sites = { findByAcquisition: async () => ({ body_diagram_version: "1" }) } as unknown as BodySiteRepository
	const findings = {
		findById: async () => ({ id: FINDING_ID, patient_id: PATIENT, department_id: DEPARTMENT }),
	} as unknown as FindingRepository
	const choices = { choose: async () => 3 } as unknown as CodeListChoiceService
	const records = {
		recordAssessment: async (_tx: never, record: DraftAssessmentRecord) => {
			recorded.push(record)
		},
		withdrawAssessment: async (_tx: never, record: DraftAssessmentRecord) => {
			withdrawn.push(record)
		},
	} as unknown as FindingRecordService
	const service = new DraftAssessmentService(assessments, sites, findings, choices, records)
	return { service, stored, recorded, withdrawn, removed }
}

const NOTED: AssessmentRow = {
	acquisition_id: DRAFT_ID,
	healing_phase_code: "sloughy",
	code_list_version: 2,
	description: "Povlak na spodině",
}

function choiceOf(healingPhaseCode: string, description: string | undefined): AssessmentChoice {
	return { healingPhaseCode, codeListVersion: 3, description }
}

function noteOf(description: string): AssessmentChoice {
	return { healingPhaseCode: undefined, codeListVersion: undefined, description }
}

describe("assessment of the record CAP-017-R03", () => {
	it("CAP-017-R09 turns the code list version of the request into the stored set version", async () => {
		const choice = await harness().service.check(TX, {
			healingPhaseCode: "granulating",
			codeListVersion: "3",
			description: "Klidné okraje",
		})

		expect(choice).toEqual(choiceOf("granulating", "Klidné okraje"))
	})

	it("CAP-017-S01 stores the healing phase with the code list version and records it on the finding", async () => {
		const run = harness()

		await run.service.apply(TX, DRAFT, FINDING_ID, choiceOf("granulating", undefined), NOW)

		expect(run.stored).toEqual([
			{ acquisitionId: DRAFT_ID, healingPhaseCode: "granulating", codeListVersion: 3, description: null },
		])
		expect(run.recorded).toEqual([
			{
				acquisitionId: DRAFT_ID,
				findingId: FINDING_ID,
				patientId: PATIENT,
				departmentId: DEPARTMENT,
				bodyDiagramVersion: "1",
				healingPhaseCode: "granulating",
				description: null,
			},
		])
	})

	it("CAP-017-R04 keeps the note when only the phase changes after a step back", async () => {
		const run = harness(NOTED)

		await run.service.apply(TX, DRAFT, FINDING_ID, choiceOf("granulating", undefined), NOW)

		expect(run.stored[0]?.description).toBe("Povlak na spodině")
	})

	it("CAP-017-S04 clears the note on an empty text", async () => {
		const run = harness(NOTED)

		await run.service.apply(TX, DRAFT, FINDING_ID, choiceOf("sloughy", "  "), NOW)

		expect(run.stored[0]?.description).toBeNull()
	})

	it("ADR-050 (doplnění D33) bod 3 withdraws the recorded assessment with the finding it was written on", async () => {
		const run = harness(NOTED)

		await run.service.withdraw(TX, DRAFT)

		expect(run.withdrawn).toEqual([expect.objectContaining({ findingId: FINDING_ID, healingPhaseCode: "sloughy" })])
	})

	it("CAP-016-R17 records the assessment again on the finding the record moved to", async () => {
		const run = harness(NOTED)

		await run.service.followFinding(TX, DRAFT, "d0000000-0000-4000-8000-000000000002")

		expect(run.recorded).toEqual([expect.objectContaining({ findingId: "d0000000-0000-4000-8000-000000000002" })])
	})

	it("CAP-017-S16 takes a note without a healing phase and leaves the code list alone", async () => {
		const choice = await harness().service.check(TX, {
			healingPhaseCode: undefined,
			codeListVersion: undefined,
			description: "Klidné okraje",
		})

		expect(choice).toEqual(noteOf("Klidné okraje"))
	})

	it("CAP-017-S16 stores the note without a healing phase and records it on the finding", async () => {
		const run = harness()

		await run.service.apply(TX, DRAFT, FINDING_ID, noteOf("Klidné okraje"), NOW)

		expect(run.stored).toEqual([
			{ acquisitionId: DRAFT_ID, healingPhaseCode: null, codeListVersion: null, description: "Klidné okraje" },
		])
		expect(run.recorded).toEqual([
			expect.objectContaining({ healingPhaseCode: undefined, description: "Klidné okraje" }),
		])
	})

	it("CAP-017-R04 keeps the healing phase when only the note changes", async () => {
		const run = harness(NOTED)

		await run.service.apply(TX, DRAFT, FINDING_ID, noteOf("Okraje klidné"), NOW)

		expect(run.stored).toEqual([
			{ acquisitionId: DRAFT_ID, healingPhaseCode: "sloughy", codeListVersion: 2, description: "Okraje klidné" },
		])
	})

	it("CAP-017-S04 removes the assessment when the cleared note leaves it without a healing phase", async () => {
		const run = harness({ ...NOTED, healing_phase_code: null, code_list_version: null })

		await run.service.apply(TX, DRAFT, FINDING_ID, noteOf("  "), NOW)

		expect(run.stored).toEqual([])
		expect(run.removed).toEqual([DRAFT_ID])
		expect(run.withdrawn).toEqual([
			expect.objectContaining({ findingId: FINDING_ID, description: "Povlak na spodině" }),
		])
	})
})
