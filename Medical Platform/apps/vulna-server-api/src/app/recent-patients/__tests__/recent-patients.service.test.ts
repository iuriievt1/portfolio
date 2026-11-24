import { AUDIT_SEARCH_METHOD } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, AUDIT_OUTCOME } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { DocumentationUnavailableException } from "../../clinical-record/exceptions/documentation-unavailable.exception"
import type { ClinicalReadService } from "../../clinical-record/services/clinical-read.service"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import {
	CURRENT,
	foundPatient,
	OTHER_PATIENT,
	PATIENT,
	SESSION,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import type { PatientLookupService } from "../../registry/services/patient-lookup.service"
import type { RecentPatientRepository } from "../repositories/recent-patient.repository"
import { RecentPatientsService } from "../services/recent-patients.service"
import type { LatestOwnRecordRow } from "../types/recent-patients.types"

const MAX_ITEMS = 10
const THIRD_PATIENT = "99999999-9999-4999-8999-999999999999"

const NEWEST: LatestOwnRecordRow = {
	acquisition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	patient_id: PATIENT,
	encounter_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	closed_at: new Date("2026-10-23T09:00:00.000Z"),
}
const OLDER: LatestOwnRecordRow = {
	acquisition_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
	patient_id: OTHER_PATIENT,
	encounter_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
	closed_at: new Date("2026-10-22T15:30:00.000Z"),
}
const OUT_OF_SCOPE: LatestOwnRecordRow = {
	acquisition_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
	patient_id: THIRD_PATIENT,
	encounter_id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
	closed_at: new Date("2026-10-21T07:00:00.000Z"),
}

interface HarnessOptions {
	rows?: LatestOwnRecordRow[]
	visibleIds?: string[]
	isStoreDown?: boolean
}

function harness(options: HarnessOptions = {}) {
	const rows = options.rows ?? [NEWEST, OLDER]
	const queries: { userId: string; limit: number }[] = []
	const visibilityQueries: string[][] = []
	const audits: NewAuditEvent[] = []
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => await work({} as never) },
	} as unknown as DatabaseService
	const records = {
		latestOwnRecordPerPatient: async (userId: string, limit: number) => {
			queries.push({ userId, limit })
			return rows
		},
	} as unknown as RecentPatientRepository
	const reads = {
		recordVisibilityOf: async (_current: never, encounterIds: string[]) => {
			visibilityQueries.push(encounterIds)
			if (options.isStoreDown === true) {
				throw new DocumentationUnavailableException()
			}
			return { userId: USER, closedAcquisitionIds: options.visibleIds ?? rows.map((row) => row.acquisition_id) }
		},
	} as unknown as ClinicalReadService
	const patients = {
		patientsById: async (ids: readonly string[]) => new Map(ids.map((id) => [id, foundPatient(id)])),
	} as unknown as PatientLookupService
	const configuration = { integer: async () => MAX_ITEMS } as unknown as ConfigurationService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audits.push(event)
		},
	} as unknown as AuditRepository
	const service = new RecentPatientsService(database, records, reads, patients, configuration, audit)
	return { service, queries, visibilityQueries, audits }
}

describe("recently documented patients of the signed-in clinician", () => {
	it("asks for the latest own closed record of each patient, at most the configured count", async () => {
		const run = harness()

		await run.service.list(CURRENT)

		expect(run.queries).toEqual([{ userId: USER, limit: MAX_ITEMS }])
	})

	it("lists each patient once, newest first, with the time the own record was closed", async () => {
		const run = harness()

		const list = await run.service.list(CURRENT)

		expect(list.items.map((item) => item.patient.patient_id)).toEqual([PATIENT, OTHER_PATIENT])
		expect(list.items[0]?.last_documented_at).toBe(NEWEST.closed_at.toISOString())
	})

	it("CAP-003-R01 CAP-020-R16 leaves out a patient whose record the clinical record store does not let the clinician see", async () => {
		const run = harness({ rows: [NEWEST, OUT_OF_SCOPE], visibleIds: [NEWEST.acquisition_id] })

		const list = await run.service.list(CURRENT)

		expect(run.visibilityQueries).toEqual([[NEWEST.encounter_id, OUT_OF_SCOPE.encounter_id]])
		expect(list.items.map((item) => item.patient.patient_id)).toEqual([PATIENT])
	})

	it("CAP-025-R18 audits the released list as a release of patient data with its count and patients", async () => {
		const run = harness()

		await run.service.list(CURRENT)

		expect(run.audits).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.PATIENT_SEARCH,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: USER,
				actorDeviceId: CURRENT.device.id,
				sessionId: SESSION,
				outcome: AUDIT_OUTCOME.MATCH,
				details: {
					search_method: AUDIT_SEARCH_METHOD.RECENT_PATIENTS,
					patient_identifiers: [foundPatient(PATIENT), foundPatient(OTHER_PATIENT)].map(
						(found) => found.identifiers[0]?.value,
					),
					released_item_count: 2,
				},
			},
		])
	})

	it("CAP-025-R18 audits an empty list without asking the clinical record store", async () => {
		const run = harness({ rows: [] })

		const list = await run.service.list(CURRENT)

		expect(list.items).toEqual([])
		expect(run.visibilityQueries).toEqual([])
		expect(run.audits[0]).toMatchObject({
			outcome: AUDIT_OUTCOME.NO_MATCH,
			details: { search_method: AUDIT_SEARCH_METHOD.RECENT_PATIENTS, released_item_count: 0 },
		})
	})

	it("CAP-020-R16 answers documentation-unavailable when the store is down and audits that nothing was released", async () => {
		const run = harness({ isStoreDown: true })

		await expect(run.service.list(CURRENT)).rejects.toBeInstanceOf(DocumentationUnavailableException)
		expect(run.audits).toHaveLength(1)
		expect(run.audits[0]?.details).toEqual({
			search_method: AUDIT_SEARCH_METHOD.RECENT_PATIENTS,
			released_item_count: 0,
		})
	})
})
