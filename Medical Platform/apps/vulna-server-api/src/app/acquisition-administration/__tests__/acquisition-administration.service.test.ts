import { ADMINISTERED_ACQUISITION_STATE, ADMINISTRATION_ERROR_CODE, RELEASE_KIND } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AcquisitionFileRepository } from "../../acquisition/repositories/acquisition-file.repository"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import { problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { AdministeredAcquisitionRepository } from "../repositories/administered-acquisition.repository"
import { AcquisitionAdministrationService } from "../services/acquisition-administration.service"
import type {
	AcquisitionInstanceRow,
	AdministeredAcquisitionQuery,
	AdministeredAcquisitionRow,
	AdministeredAcquisitionView,
} from "../types/acquisition-administration.types"
import {
	ADMINISTRATOR,
	BIRTH_NUMBER,
	BIRTH_NUMBER_SYSTEM,
	CONFIRMED_INSTANCE,
	DELIVERED,
	DRAFT,
	PATIENT,
	SECONDARY_CAPTURE,
	SERIES_INSTANCE_UID,
	SOP_INSTANCE_UID,
	STUDY_INSTANCE_UID,
} from "./acquisition-administration-fixtures"

const PAGE_SIZE = { defaultSize: 50, maxSize: 100 }
const NEXT_CURSOR = "next-page"
const RECEIVED_DRAFT_FILES = 2
const UNKNOWN_ACQUISITION = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"

interface HarnessOptions {
	rows?: AdministeredAcquisitionRow[]
	instances?: AcquisitionInstanceRow[]
}

function harness(options: HarnessOptions = {}) {
	const rows = options.rows ?? [DELIVERED]
	const queries: AdministeredAcquisitionQuery[] = []
	const audits: NewAuditEvent[] = []
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const acquisitions = {
		page: async (query: AdministeredAcquisitionQuery) => {
			queries.push(query)
			return { rows, nextCursor: NEXT_CURSOR }
		},
		findById: async (acquisitionId: string) => rows.find((row) => row.id === acquisitionId),
		instancesOf: async () => options.instances ?? [CONFIRMED_INSTANCE],
	} as unknown as AdministeredAcquisitionRepository
	const files = {
		receivedCountsOf: async (_sql: never, acquisitionIds: readonly string[]) =>
			acquisitionIds.map((acquisitionId) => ({ acquisition_id: acquisitionId, received: RECEIVED_DRAFT_FILES })),
	} as unknown as AcquisitionFileRepository
	const patients = {
		patientsById: async () => new Map([[PATIENT.patient.id, PATIENT]]),
	} as unknown as PatientLookupService
	const configuration = { pageSize: async () => PAGE_SIZE } as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new AcquisitionAdministrationService(database, acquisitions, files, patients, configuration, audit)
	return { service, queries, audits }
}

describe("acquisition detail for the administrator CAP-004-R10", () => {
	it("CAP-004-S02 shows the Study, Series and SOP Instance UID and the patient identifier", async () => {
		const run = harness()

		const detail = await run.service.detail(ADMINISTRATOR, DELIVERED.id)

		expect(detail).toMatchObject({
			id: DELIVERED.id,
			state: DELIVERED.state,
			study_instance_uid: STUDY_INSTANCE_UID,
			series_instance_uid: SERIES_INSTANCE_UID,
			instance: [
				{
					sop_instance_uid: SOP_INSTANCE_UID,
					sop_class: SECONDARY_CAPTURE,
					pacs_status: CONFIRMED_INSTANCE.delivery_state,
				},
			],
			patient_identifiers: [{ system: BIRTH_NUMBER_SYSTEM, value: BIRTH_NUMBER }],
		})
	})

	it("CAP-025-R28 audits the opened detail as a release of patient data within the administrator session", async () => {
		const run = harness()

		await run.service.detail(ADMINISTRATOR, DELIVERED.id)

		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.PATIENT_RECORD_RELEASE,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				sessionId: ADMINISTRATOR.sessionId,
				objectId: DELIVERED.id,
				outcome: AUDIT_OUTCOME.RELEASED,
				details: {
					patient_identifier: BIRTH_NUMBER,
					release_kind: RELEASE_KIND.ACQUISITION_DETAIL,
					encounter_id: DELIVERED.encounter_id,
					acquisition_id: DELIVERED.id,
					released_item_count: 1,
				},
			},
		])
	})

	it("CAP-025-R28 audits an unknown acquisition with nothing released and answers not-found", async () => {
		const run = harness()

		const problem = await problemOf(run.service.detail(ADMINISTRATOR, UNKNOWN_ACQUISITION))

		expect(problem.getStatus()).toBe(HttpStatus.NOT_FOUND)
		expect(problem.code).toBe(ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]?.details).toEqual({
			release_kind: RELEASE_KIND.ACQUISITION_DETAIL,
			acquisition_id: UNKNOWN_ACQUISITION,
			released_item_count: 0,
		})
	})

	it("counts the files the server holds for a draft and the announced files for a closed record", async () => {
		const run = harness({ rows: [DELIVERED, DRAFT] })

		const draft = await run.service.detail(ADMINISTRATOR, DRAFT.id)
		const delivered = await run.service.detail(ADMINISTRATOR, DELIVERED.id)

		expect(draft.file_count).toBe(RECEIVED_DRAFT_FILES)
		expect(delivered.file_count).toBe(DELIVERED.file_count)
	})
})

describe("acquisition search for the administrator CAP-004-R10", () => {
	it("passes the filters and the configured page size to the query", async () => {
		const run = harness()

		await run.service.search(ADMINISTRATOR, {
			state: ADMINISTERED_ACQUISITION_STATE.FAILED,
			patient_identifier: "800101/1234",
			from: "2026-10-01T00:00:00Z",
			to: "2026-10-31T23:59:59Z",
		})

		expect(run.queries).toEqual([
			{
				limit: PAGE_SIZE.defaultSize,
				cursor: undefined,
				state: ADMINISTERED_ACQUISITION_STATE.FAILED,
				patientIdentifier: "800101/1234",
				from: "2026-10-01T00:00:00Z",
				to: "2026-10-31T23:59:59Z",
			},
		])
	})

	it("returns the rows with their DICOM study and series and the cursor of the next page", async () => {
		const run = harness({ rows: [DELIVERED, DRAFT] })

		const page = await run.service.search(ADMINISTRATOR, {})
		const items: AdministeredAcquisitionView[] = page.items ?? []

		expect(page.next_cursor).toBe(NEXT_CURSOR)
		expect(items.map((item) => item.id)).toEqual([DELIVERED.id, DRAFT.id])
		expect(items[0]).toMatchObject({
			study_instance_uid: STUDY_INSTANCE_UID,
			series_instance_uid: SERIES_INSTANCE_UID,
		})
		expect(items[0]?.instance).toBeUndefined()
	})

	it("CAP-025-R03 audits the viewed list with the count of its rows and their patients", async () => {
		const run = harness({ rows: [DELIVERED, DRAFT] })

		await run.service.search(ADMINISTRATOR, {})

		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.ACQUISITIONS_VIEWED,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: ADMINISTRATOR.userId,
				sessionId: ADMINISTRATOR.sessionId,
				outcome: AUDIT_OUTCOME.SUCCESS,
				details: { released_item_count: 2, patient_identifiers: [BIRTH_NUMBER] },
			},
		])
	})

	it("CAP-025-R03 audits an empty list with a zero count", async () => {
		const run = harness({ rows: [] })

		const page = await run.service.search(ADMINISTRATOR, {})

		expect(page.items).toEqual([])
		expect(run.audits[0]?.details).toEqual({ released_item_count: 0, patient_identifiers: [] })
	})
})
