import { ERROR_CODE } from "@ansora/contracts"
import {
	ACQUISITION_KIND,
	CLINICAL_RECORD_FAILURE,
	type ClinicalReader,
	ClinicalRecordStoreError,
	type EncounterResources,
	type HistoryRecords,
	type ImageHistoryPort,
} from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import { describe, expect, it } from "vitest"
import {
	CURRENT,
	ENCOUNTER,
	fakeDatabase,
	PATIENT,
	problemOf,
	USER,
} from "../../encounter/__tests__/encounter-fixtures"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import { READ_CIRCUIT_FAILURE_THRESHOLD } from "../constants/read-circuit.constants"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { ClinicalReadService } from "../services/clinical-read.service"
import type { ClinicalRecordStoreService } from "../services/clinical-record-store.service"
import { ReadCircuitService } from "../services/read-circuit.service"
import type { ResourceLink } from "../types/clinical-record.types"
import { shownWound } from "./clinical-read-fixtures"

const MEMBERSHIP = "membership-1"
const FINDING = "f3000000-0000-4000-8000-000000000001"
const RECORD = "a0000000-0000-4000-8000-000000000001"
const UNLINKED_ENCOUNTER = "88888888-8888-4888-8888-888888888899"
const RECORDS: HistoryRecords = {
	findings: [{ findingId: FINDING, woundTypeCode: "leg-ulcer" }],
	wounds: [],
	scans: [],
}

type LinkKey = Omit<ResourceLink, "resourceId">

interface Setup {
	links: readonly ResourceLink[]
	isStoreConfigured: boolean
	failure: Error | undefined
}

interface Asked {
	reader: ClinicalReader
	target: unknown
}

function keyOf(link: LinkKey): string {
	return `${link.resourceType}:${link.localKind}:${link.localId}`
}

function linkOf(resourceType: string, localKind: string, localId: string, resourceId: string): ResourceLink {
	return { resourceType, localKind, localId, resourceId }
}

const MEMBERSHIP_LINK = linkOf(FHIR_RESOURCE_TYPE.PROJECT_MEMBERSHIP, LOCAL_KIND.ACTOR, USER, MEMBERSHIP)
const PATIENT_LINK = linkOf(FHIR_RESOURCE_TYPE.PATIENT, LOCAL_KIND.PATIENT, PATIENT, "patient-1")
const CONDITION_LINK = linkOf(FHIR_RESOURCE_TYPE.CONDITION, LOCAL_KIND.FINDING, FINDING, "condition-1")
const ENCOUNTER_LINK = linkOf(FHIR_RESOURCE_TYPE.ENCOUNTER, LOCAL_KIND.ENCOUNTER, ENCOUNTER, "encounter-1")
const STUDY_LINK = linkOf(FHIR_RESOURCE_TYPE.IMAGING_STUDY, LOCAL_KIND.IMAGING_STUDY, ENCOUNTER, "study-1")

function harness(setup: Partial<Setup> = {}) {
	const state: Setup = {
		links: [MEMBERSHIP_LINK, PATIENT_LINK, CONDITION_LINK, ENCOUNTER_LINK, STUDY_LINK],
		isStoreConfigured: true,
		failure: undefined,
		...setup,
	}
	const known = new Map(state.links.map((link) => [keyOf(link), link.resourceId]))
	const asked: Asked[] = []
	const failures: string[] = []
	async function answered<T>(reader: ClinicalReader, target: unknown, value: T): Promise<T> {
		asked.push({ reader, target })
		if (state.failure !== undefined) {
			throw state.failure
		}
		return value
	}
	const history: ImageHistoryPort = {
		closedWoundsOfPatient: async (reader, patient) => await answered(reader, patient, RECORDS),
		closedScansOfPatient: async (reader, patient) => await answered(reader, patient, []),
		closedAcquisitionsOfEncounters: async (reader, encounters: readonly EncounterResources[]) =>
			await answered(reader, encounters, [RECORD]),
		closedRecordsOfFinding: async (reader, condition) => await answered(reader, condition, RECORDS),
		closedRecord: async (reader, acquisition) =>
			await answered(reader, acquisition, {
				findings: [],
				wounds: acquisition.acquisitionId === RECORD ? [shownWound(RECORD)] : [],
				scans: [],
			}),
	}
	const links = {
		resourceIdOf: async (_sql: never, link: LinkKey) => known.get(keyOf(link)),
		resourceIdsOf: async (_sql: never, link: Omit<LinkKey, "localId">, localIds: readonly string[]) =>
			new Map(
				localIds.flatMap((localId) => {
					const resourceId = known.get(keyOf({ ...link, localId }))
					return resourceId === undefined ? [] : [[localId, resourceId] as const]
				}),
			),
	} as unknown as FhirResourceLinkRepository
	const stores = {
		history: async () => (state.isStoreConfigured ? history : undefined),
		reportFailure: (subject: string) => {
			failures.push(subject)
		},
	} as unknown as ClinicalRecordStoreService
	return { service: new ClinicalReadService(fakeDatabase(), links, stores, new ReadCircuitService()), asked, failures }
}

// ADR-053 bod 3, ADR-054 bod 2, CAP-020-R16, datovy-model.md 13.2
describe("clinical reads on behalf of the signed-in user", () => {
	it("CAP-020-R16 reads the patient on behalf of the membership of the user", async () => {
		const run = harness()

		expect(await run.service.closedWoundsOfPatient(CURRENT, PATIENT)).toEqual(RECORDS)
		expect(run.asked).toEqual([{ reader: { membershipResourceId: MEMBERSHIP }, target: "patient-1" }])
	})

	it("CAP-020-R18 asks the store nothing for a patient it holds no records of", async () => {
		const run = harness({ links: [MEMBERSHIP_LINK] })

		expect(await run.service.closedScansOfPatient(CURRENT, PATIENT)).toEqual([])
		expect(await run.service.closedWoundsOfPatient(CURRENT, PATIENT)).toEqual({ findings: [], wounds: [] })
		expect(await run.service.closedRecordsOfFinding(CURRENT, FINDING)).toEqual({ findings: [], wounds: [], scans: [] })
		expect(run.asked).toEqual([])
	})

	it("ADR-053 (doplnění 2026-09-24) bod 3 answers documentation unavailable for a user without a membership", async () => {
		const run = harness({ links: [PATIENT_LINK] })

		const problem = await problemOf(run.service.closedWoundsOfPatient(CURRENT, PATIENT))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.asked).toEqual([])
	})

	it("ADR-054 bod 5 answers documentation unavailable without a configured store", async () => {
		const problem = await problemOf(
			harness({ isStoreConfigured: false }).service.closedScansOfPatient(CURRENT, PATIENT),
		)

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})

	it("CAP-020-S10 reports a failing store and answers documentation unavailable", async () => {
		const run = harness({
			failure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "the store did not answer"),
		})

		const problem = await problemOf(run.service.closedRecordsOfFinding(CURRENT, FINDING))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.failures).toEqual([`closed records of finding ${FINDING}`])
	})

	it("CAP-020-S10 stops asking a store that keeps failing and answers documentation unavailable at once", async () => {
		const run = harness({
			failure: new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "the store did not answer"),
		})
		for (let failure = 0; failure < READ_CIRCUIT_FAILURE_THRESHOLD; failure += 1) {
			await problemOf(run.service.closedRecordsOfFinding(CURRENT, FINDING))
		}

		const problem = await problemOf(run.service.closedRecordsOfFinding(CURRENT, FINDING))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.asked).toHaveLength(READ_CIRCUIT_FAILURE_THRESHOLD)
	})

	it("CAP-014-R22 pairs every visit the store holds with its study and leaves out the others", async () => {
		const run = harness()

		const visibility = await run.service.recordVisibilityOf(CURRENT, [ENCOUNTER, UNLINKED_ENCOUNTER])

		expect(visibility).toEqual({ userId: USER, closedAcquisitionIds: [RECORD] })
		expect(run.asked).toEqual([
			{
				reader: { membershipResourceId: MEMBERSHIP },
				target: [{ encounterResourceId: "encounter-1", imagingStudyResourceId: "study-1" }],
			},
		])
	})

	it("CAP-015-R30 gives no closed record for visits the store does not hold, without asking it", async () => {
		const run = harness({ links: [MEMBERSHIP_LINK] })

		expect(await run.service.recordVisibilityOf(CURRENT, [ENCOUNTER])).toEqual({
			userId: USER,
			closedAcquisitionIds: [],
		})
		expect(run.asked).toEqual([])
	})

	it("CAP-020-S29 sees a closed record only when the store shows a wound or a document of it", async () => {
		const run = harness()
		const hidden = "a0000000-0000-4000-8000-000000000099"

		expect(
			await run.service.isClosedRecordVisible(CURRENT, { acquisitionId: RECORD, kind: ACQUISITION_KIND.PHOTO }),
		).toBe(true)
		expect(
			await run.service.isClosedRecordVisible(CURRENT, { acquisitionId: hidden, kind: ACQUISITION_KIND.PHOTO }),
		).toBe(false)
	})
})
