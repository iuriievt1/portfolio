import { ERROR_CODE } from "@ansora/contracts"
import {
	CLINICAL_RECORD_FAILURE,
	type ClinicalEncounterRecord,
	ClinicalRecordStoreError,
	type ClinicalRecordStorePort,
} from "@ansora/vulna-domain"
import { HttpStatus } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { describe, expect, it } from "vitest"
import { encounterRow, PATIENT, problemOf } from "../../encounter/__tests__/encounter-fixtures"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { ClinicalPatientRepository } from "../repositories/clinical-patient.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { EncounterRecordService } from "../services/encounter-record.service"
import type { ResourceLink } from "../types/clinical-record.types"
import { storesWith } from "./clinical-record-fixtures"

const DEPARTMENT_ROW = { id: "77777777-7777-4777-8777-777777777777", code: "KOC" }
const TX = {} as postgres.TransactionSql

function harness(store: Partial<ClinicalRecordStorePort> | undefined) {
	const links: ResourceLink[] = []
	const stores = storesWith(store)
	const patients = {
		patientOf: async () => ({
			patientId: PATIENT,
			familyName: "Nováková",
			givenName: "Jana",
			birthDate: "1970-02-03",
			sex: "female",
			identifiers: [],
			demographicsRevision: 1,
		}),
	} as unknown as ClinicalPatientRepository
	const actors = { departmentOf: async () => DEPARTMENT_ROW } as unknown as ClinicalActorRepository
	const linkRepository = {
		upsert: async (_tx: never, written: readonly ResourceLink[]) => {
			links.push(...written)
		},
	} as unknown as FhirResourceLinkRepository
	return { service: new EncounterRecordService(stores, patients, actors, linkRepository), links }
}

function storeWith(answer: (record: ClinicalEncounterRecord) => Promise<{ patient: string; encounter: string }>) {
	const written: ClinicalEncounterRecord[] = []
	const store: Partial<ClinicalRecordStorePort> = {
		recordEncounter: async (record) => {
			written.push(record)
			return await answer(record)
		},
	}
	return { store, written }
}

// CAP-014-R17, ADR-054 bod 3, ADR-054 bod 5
describe("synchronous write of the patient and the visit", () => {
	it("writes the visit in its state with the department and keeps the links to the resources", async () => {
		const { store, written } = storeWith(async () => ({ patient: "patient-1", encounter: "encounter-1" }))
		const run = harness(store)

		await run.service.record(TX, encounterRow())

		expect(written[0]?.encounter).toMatchObject({ status: "in_progress", department: DEPARTMENT_ROW })
		expect(run.links.map((link) => [link.resourceType, link.resourceId])).toEqual([
			["Patient", "patient-1"],
			["Encounter", "encounter-1"],
		])
	})

	it("answers that documentation is unavailable when the store is down", async () => {
		const { store } = storeWith(async () => {
			throw new ClinicalRecordStoreError(CLINICAL_RECORD_FAILURE.UNAVAILABLE, "timeout")
		})

		const problem = await problemOf(harness(store).service.record(TX, encounterRow()))

		expect(problem.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE)
		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
	})

	it("answers the same when the store is not configured, and writes no link", async () => {
		const run = harness(undefined)

		const problem = await problemOf(run.service.record(TX, encounterRow()))

		expect(problem.code).toBe(ERROR_CODE.DOCUMENTATION_UNAVAILABLE)
		expect(run.links).toEqual([])
	})
})
