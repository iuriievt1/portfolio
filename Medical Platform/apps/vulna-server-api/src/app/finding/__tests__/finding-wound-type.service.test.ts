import { ERROR_CODE } from "@ansora/contracts"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { FindingRecordService } from "../../clinical-record/services/finding-record.service"
import type { DraftWoundTypeRecord } from "../../clinical-record/types/clinical-record.types"
import type { CodeListChoiceService } from "../../code-list/services/code-list-choice.service"
import { DEPARTMENT, PATIENT, problemOf, USER } from "../../encounter/__tests__/encounter-fixtures"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { WoundTypeLockedError } from "../errors/wound-type-locked.error"
import type { FindingRepository } from "../repositories/finding.repository"
import { FindingWoundTypeService } from "../services/finding-wound-type.service"
import type { FindingRow, LocatedDraft, WoundTypeChoice } from "../types/finding.types"

const TX = {} as postgres.TransactionSql
const DRAFT_ID = "a0000000-0000-4000-8000-000000000001"
const FINDING_ID = "d0000000-0000-4000-8000-000000000001"
const OTHER_USER = "e0000000-0000-4000-8000-000000000009"
const SET_VERSION = 3
const DRAFT: LocatedDraft = { id: DRAFT_ID, patient_id: PATIENT, department_id: DEPARTMENT, finding_id: FINDING_ID }

function findingRow(overrides: Partial<FindingRow> = {}): FindingRow {
	return {
		id: FINDING_ID,
		patient_id: PATIENT,
		department_id: DEPARTMENT,
		finding_key: "b0000000-0000-4000-8000-000000000001",
		origin_acquisition_id: DRAFT_ID,
		created_by: USER,
		created_at: new Date("2026-10-08T08:00:00Z"),
		wound_type_code: null,
		wound_type_code_list_version: null,
		wound_type_set_by: null,
		...overrides,
	}
}

function harness(finding: FindingRow | undefined, closed = false, offered = true) {
	const set: WoundTypeChoice[] = []
	const recorded: DraftWoundTypeRecord[] = []
	const findings = {
		findById: async () => finding,
		hasClosedRecord: async () => closed,
		setWoundType: async (_tx: never, _id: string, choice: WoundTypeChoice) => {
			set.push(choice)
		},
	} as unknown as FindingRepository
	const choices = {
		choose: async () => {
			if (!offered) {
				throw new ProblemException(HttpStatus.UNPROCESSABLE_ENTITY, ERROR_CODE.RECORD_REJECTED)
			}
			return SET_VERSION
		},
	} as unknown as CodeListChoiceService
	const records = {
		recordWoundType: async (_tx: never, record: DraftWoundTypeRecord) => {
			recorded.push(record)
		},
	} as unknown as FindingRecordService
	return { service: new FindingWoundTypeService(findings, choices, records), set, recorded }
}

const REQUEST = { code: "leg-ulcer", codeListVersion: String(SET_VERSION), userId: USER }
const CHOICE: WoundTypeChoice = { code: "leg-ulcer", codeListVersion: SET_VERSION, setBy: USER }

describe("wound type checked before anything is written CAP-017-R02", () => {
	it("CAP-017-R16 turns the code list version of the request into the stored set version", async () => {
		const choice = await harness(findingRow()).service.check(TX, FINDING_ID, REQUEST)

		expect(choice).toEqual(CHOICE)
	})

	it("CAP-017-R16 refuses a code the code list does not offer", async () => {
		const problem = await problemOf(harness(findingRow(), false, false).service.check(TX, FINDING_ID, REQUEST))

		expect(problem.code).toBe(ERROR_CODE.RECORD_REJECTED)
	})

	it("CAP-017-S13 lets the operator overwrite the type before the first record is closed", async () => {
		const run = harness(
			findingRow({ wound_type_code: "pressure-ulcer", wound_type_code_list_version: 3, wound_type_set_by: USER }),
		)

		await expect(run.service.check(TX, FINDING_ID, REQUEST)).resolves.toEqual(CHOICE)
	})

	it("CAP-017-S14 refuses another type once the finding has a closed record", async () => {
		const run = harness(
			findingRow({ wound_type_code: "pressure-ulcer", wound_type_code_list_version: 3, wound_type_set_by: USER }),
			true,
		)

		await expect(run.service.check(TX, FINDING_ID, REQUEST)).rejects.toBeInstanceOf(WoundTypeLockedError)
		expect(run.set).toEqual([])
		expect(run.recorded).toEqual([])
	})

	it("refuses another operator who neither founded the finding nor chose its type", async () => {
		const run = harness(findingRow({ created_by: OTHER_USER }))

		await expect(run.service.check(TX, FINDING_ID, REQUEST)).rejects.toBeInstanceOf(WoundTypeLockedError)
	})

	it("CAP-020-R19 lets the same type through a finding with a closed record", async () => {
		const run = harness(
			findingRow({ wound_type_code: "leg-ulcer", wound_type_code_list_version: 3, wound_type_set_by: USER }),
			true,
		)

		await expect(run.service.check(TX, FINDING_ID, REQUEST)).resolves.toEqual(CHOICE)
	})

	it("CAP-020-R13 never locks the finding the request founds", async () => {
		const run = harness(undefined, true)

		await expect(run.service.check(TX, undefined, REQUEST)).resolves.toEqual(CHOICE)
	})
})

describe("wound type written on the finding CAP-017-R02", () => {
	it("CAP-017-S01 writes the type on the new finding with the code list version and records it", async () => {
		const run = harness(findingRow())

		await run.service.apply(TX, DRAFT, FINDING_ID, CHOICE)

		expect(run.set).toEqual([CHOICE])
		expect(run.recorded).toEqual([
			{
				findingId: FINDING_ID,
				acquisitionId: DRAFT_ID,
				patientId: PATIENT,
				departmentId: DEPARTMENT,
				woundTypeCode: "leg-ulcer",
			},
		])
	})

	it("CAP-020-R19 changes nothing when the finding already carries the type", async () => {
		const run = harness(
			findingRow({ wound_type_code: "leg-ulcer", wound_type_code_list_version: 3, wound_type_set_by: USER }),
			true,
		)

		await run.service.apply(TX, DRAFT, FINDING_ID, CHOICE)

		expect(run.set).toEqual([])
		expect(run.recorded).toEqual([])
	})
})
