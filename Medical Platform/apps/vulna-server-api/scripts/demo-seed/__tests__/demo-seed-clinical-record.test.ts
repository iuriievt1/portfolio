import { ACQUISITION_KIND } from "@ansora/contracts"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import type { SeriesOwner, SeriesRow } from "../../../src/app/acquisition/types/acquisition.types"
import { seriesIdOfDocument } from "../../../src/app/acquisition/utils/document-identity"
import type {
	ClosedScanRecord,
	ClosedWoundRecord,
	DraftAssessmentRecord,
	DraftFindingRecord,
	DraftWoundTypeRecord,
	FoundedDocumentRecord,
	WoundTypeChangeRecord,
} from "../../../src/app/clinical-record/types/clinical-record.types"
import type { EncounterRow } from "../../../src/app/encounter/types/encounter.types"
import {
	type ClinicalRecorders,
	DEMO_STATION,
	type OperatorPatience,
	recordClinicalHistory,
	requireRecordedOperator,
} from "../clinical-record"
import { DEMO_DATASET } from "../dataset"
import type { DemoPlan, PlannedAcquisition, PlannedChange, PlannedEncounter, SeedContext } from "../demo-types"
import { planOf } from "../plan"

const TX = {} as postgres.TransactionSql
const PATIENT_ID = "55555555-5555-4555-8555-555555555555"
const OPERATOR = "11111111-1111-4111-8111-111111111111"
const DEPARTMENT = "77777777-7777-4777-8777-777777777777"
const MAIN_PATIENT = DEMO_DATASET.patients[0]

if (MAIN_PATIENT === undefined) {
	throw new Error("the demo dataset has no patient")
}
const PLAN = planOf(MAIN_PATIENT, PATIENT_ID)

function titleCodeOf(title: string): string {
	return `code-${title}`
}

const CONTEXT: SeedContext = {
	operatorUserId: OPERATOR,
	departmentId: DEPARTMENT,
	configurationVersionId: 1,
	codeListVersion: 1,
	titleCodes: new Map(PLAN.documents.map((document) => [document.title, titleCodeOf(document.title)])),
}

interface ChangedWound {
	change: PlannedChange
	records: PlannedAcquisition[]
}

function changedWound(): ChangedWound {
	const [change] = PLAN.changes
	if (change === undefined) {
		throw new Error("the demo plan changes no wound type")
	}
	const records = PLAN.acquisitions
		.filter((acquisition) => acquisition.finding_id === change.finding_id)
		.sort((first, second) => first.closed_at.getTime() - second.closed_at.getTime())
	return { change, records }
}

interface Written {
	steps: string[]
	findings: DraftFindingRecord[]
	woundTypes: DraftWoundTypeRecord[]
	assessments: DraftAssessmentRecord[]
	changes: WoundTypeChangeRecord[]
	documents: FoundedDocumentRecord[]
	wounds: ClosedWoundRecord[]
	scans: ClosedScanRecord[]
	series: Map<string, { owner: SeriesOwner; row: SeriesRow }>
}

function encounterRowOf(planned: PlannedEncounter): EncounterRow {
	return {
		id: planned.id,
		patient_id: planned.patient_id,
		study_instance_uid: planned.study_instance_uid,
		started_at: planned.started_at,
		department_id: DEPARTMENT,
	} as unknown as EncounterRow
}

function recordersFor(plan: DemoPlan) {
	const written: Written = {
		steps: [],
		findings: [],
		woundTypes: [],
		assessments: [],
		changes: [],
		documents: [],
		wounds: [],
		scans: [],
		series: new Map(),
	}
	const recorders = {
		encounterRows: {
			findById: async (_tx: never, id: string) => {
				const planned = plan.encounters.find((encounter) => encounter.id === id)
				return planned === undefined ? undefined : encounterRowOf(planned)
			},
		},
		encounters: {
			record: async (_tx: never, encounter: EncounterRow) => {
				written.steps.push(`visit ${encounter.id}`)
			},
		},
		findings: {
			recordDraft: async (_tx: never, record: DraftFindingRecord) => {
				written.steps.push(`finding ${record.acquisitionId}`)
				written.findings.push(record)
			},
			recordWoundType: async (_tx: never, record: DraftWoundTypeRecord) => {
				written.steps.push(`wound type ${record.acquisitionId}`)
				written.woundTypes.push(record)
			},
			recordAssessment: async (_tx: never, record: DraftAssessmentRecord) => {
				written.steps.push(`assessment ${record.acquisitionId}`)
				written.assessments.push(record)
			},
			recordWoundTypeChange: async (_tx: never, record: WoundTypeChangeRecord) => {
				written.steps.push(`change ${record.changeId}`)
				written.changes.push(record)
			},
		},
		documents: {
			recordDraft: async (_tx: never, record: FoundedDocumentRecord) => {
				written.steps.push(`document ${record.acquisitionId}`)
				written.documents.push(record)
			},
		},
		closures: {
			recordWound: async (_tx: never, record: ClosedWoundRecord) => {
				written.steps.push(`closure ${record.acquisitionId}`)
				written.wounds.push(record)
			},
			recordScan: async (_tx: never, record: ClosedScanRecord) => {
				written.steps.push(`closure ${record.acquisitionId}`)
				written.scans.push(record)
			},
		},
		series: {
			lockEncounter: async (_tx: never, encounterId: string) => {
				written.steps.push(`lock ${encounterId}`)
			},
			assign: async (_tx: never, owner: SeriesOwner, id: string) => {
				const known = written.series.get(id)
				if (known !== undefined) {
					return known.row
				}
				const number = written.series.size + 1
				const row = { id, series_instance_uid: `2.25.${number}`, series_number: number }
				written.series.set(id, { owner, row })
				return row
			},
		},
	} as unknown as ClinicalRecorders
	return { recorders, written }
}

function stepIndex(written: Written, step: string): number {
	const index = written.steps.indexOf(step)
	if (index < 0) {
		throw new Error(`the step ${step} was not written`)
	}
	return index
}

// ADR-054 bod 1, ADR-054 bod 5, CAP-020-R16, Q-040
describe("demo history written into the clinical record", () => {
	it("ADR-054 bod 1 records every visit before any record closed in it", async () => {
		const run = recordersFor(PLAN)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		const lastVisit = Math.max(...PLAN.encounters.map((encounter) => stepIndex(run.written, `visit ${encounter.id}`)))
		const firstRecord = Math.min(
			...PLAN.acquisitions.map((acquisition) => stepIndex(run.written, `closure ${acquisition.id}`)),
		)
		expect(lastVisit).toBeLessThan(firstRecord)
	})

	it("CAP-021-R27 closes every record once, in the order it was closed", async () => {
		const run = recordersFor(PLAN)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		const closed = [...run.written.wounds, ...run.written.scans].sort(
			(first, second) =>
				stepIndex(run.written, `closure ${first.acquisitionId}`) -
				stepIndex(run.written, `closure ${second.acquisitionId}`),
		)
		expect(closed.map((record) => record.acquisitionId).sort()).toEqual(
			PLAN.acquisitions.map((acquisition) => acquisition.id).sort(),
		)
		expect(closed.map((record) => record.closedAt.getTime())).toEqual(
			closed.map((record) => record.closedAt.getTime()).sort((first, second) => first - second),
		)
	})

	it("CAP-020-R13 places the finding and its wound type with the first record of the wound only", async () => {
		const run = recordersFor(PLAN)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		const origins = PLAN.findings.map((finding) => finding.origin_acquisition_id).sort()
		expect(run.written.findings.map((record) => record.acquisitionId).sort()).toEqual(origins)
		expect(run.written.woundTypes.map((record) => record.acquisitionId).sort()).toEqual(origins)
		expect(
			run.written.wounds
				.filter((record) => record.isFirstRecordOfFinding)
				.map((record) => record.acquisitionId)
				.sort(),
		).toEqual(origins)
		for (const origin of origins) {
			expect(stepIndex(run.written, `finding ${origin}`)).toBeLessThan(stepIndex(run.written, `closure ${origin}`))
		}
	})

	it("CAP-017-R03 records the assessment of every wound record before closing it", async () => {
		const run = recordersFor(PLAN)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		const photos = PLAN.acquisitions.filter((acquisition) => acquisition.kind === ACQUISITION_KIND.PHOTO)
		expect(run.written.assessments).toHaveLength(photos.length)
		for (const photo of photos) {
			expect(stepIndex(run.written, `assessment ${photo.id}`)).toBeLessThan(
				stepIndex(run.written, `closure ${photo.id}`),
			)
		}
	})

	it("CAP-020-R19 closes each record of the changed wound with the type it closed with", async () => {
		const run = recordersFor(PLAN)
		const { change, records } = changedWound()
		const closedTypes = records.map((record) => record.closed_wound_type_code)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		expect(new Set(closedTypes)).toEqual(new Set([change.previous_wound_type_code, change.wound_type_code]))
		expect(
			run.written.wounds
				.filter((record) => record.findingId === change.finding_id)
				.map((record) => record.woundTypeCode),
		).toEqual(closedTypes)
		expect(run.written.woundTypes.filter((record) => record.findingId === change.finding_id)).toEqual([
			expect.objectContaining({ woundTypeCode: change.previous_wound_type_code }),
		])
	})

	it("CAP-020-R21 changes the type of the demo wound between the records closed before and after the change", async () => {
		const run = recordersFor(PLAN)
		const { change, records } = changedWound()

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		expect(run.written.changes).toEqual([
			{
				changeId: change.id,
				findingId: change.finding_id,
				patientId: PATIENT_ID,
				departmentId: DEPARTMENT,
				woundTypeCode: change.wound_type_code,
				changedAt: change.changed_at,
				changedBy: OPERATOR,
			},
		])
		const changedAt = stepIndex(run.written, `change ${change.id}`)
		expect(stepIndex(run.written, `closure ${records[0]?.id}`)).toBeLessThan(changedAt)
		expect(changedAt).toBeLessThan(stepIndex(run.written, `closure ${records[1]?.id}`))
	})

	it("CAP-021-R39 founds every scanned document in its own series before closing it", async () => {
		const run = recordersFor(PLAN)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		for (const document of PLAN.documents) {
			const series = run.written.series.get(seriesIdOfDocument(document.id))
			expect(series?.owner).toEqual(expect.objectContaining({ documentId: document.id }))
			expect(stepIndex(run.written, `document ${document.acquisition_id}`)).toBeLessThan(
				stepIndex(run.written, `closure ${document.acquisition_id}`),
			)
		}
		expect(run.written.scans).toHaveLength(PLAN.documents.length)
		expect(Object.fromEntries(run.written.scans.map((record) => [record.acquisitionId, record.titleCode]))).toEqual(
			Object.fromEntries(PLAN.documents.map((document) => [document.acquisition_id, titleCodeOf(document.title)])),
		)
	})

	it("Q-040 closes the demo records on the synthetic station, never on a registered device", async () => {
		const run = recordersFor(PLAN)

		await recordClinicalHistory(TX, PLAN, CONTEXT, run.recorders)

		expect(new Set([...run.written.wounds, ...run.written.scans].map((record) => record.station))).toEqual(
			new Set([DEMO_STATION]),
		)
	})
})

const QUICK_PATIENCE: OperatorPatience = { attempts: 3, intervalMilliseconds: 0 }

function operatorRecorders(memberships: readonly (string | undefined)[]) {
	const answers = [...memberships]
	let drains = 0
	const recorders = {
		actorWriter: {
			writeNext: async () => {
				drains += 1
				return false
			},
		},
		links: { resourceIdOf: async () => answers.shift() },
	} as unknown as ClinicalRecorders
	return { recorders, drains: () => drains }
}

// ADR-050, CAP-021-R38, ADR-053 bod 6
describe("demo clinician in the clinical record", () => {
	it("refuses to write the demo history while the clinician never reaches the store", async () => {
		const run = operatorRecorders([undefined, undefined, undefined])

		await expect(requireRecordedOperator(TX, run.recorders, OPERATOR, QUICK_PATIENCE)).rejects.toThrow(
			"not in the clinical record store",
		)
		expect(run.drains()).toBe(QUICK_PATIENCE.attempts)
	})

	it("CAP-001-R31 waits for the actor write the server finishes meanwhile", async () => {
		const run = operatorRecorders([undefined, "membership-1"])

		await expect(requireRecordedOperator(TX, run.recorders, OPERATOR, QUICK_PATIENCE)).resolves.toBeUndefined()
		expect(run.drains()).toBe(2)
	})

	it("accepts a clinician the store already holds at once", async () => {
		const run = operatorRecorders(["membership-1"])

		await expect(requireRecordedOperator(TX, run.recorders, OPERATOR, QUICK_PATIENCE)).resolves.toBeUndefined()
		expect(run.drains()).toBe(1)
	})
})
