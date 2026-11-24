import { Readable } from "node:stream"
import {
	ACQUISITION_KIND,
	CLINICAL_RECORD_FAILURE,
	type ClinicalActor,
	type ClinicalClosure,
	type ClinicalDraftAssessment,
	type ClinicalDraftFinding,
	type ClinicalDraftWoundType,
	type ClinicalReader,
	ClinicalRecordStoreError,
	ENCOUNTER_STATUS,
	type HistoryRecords,
} from "@ansora/vulna-domain/ports"
import { getStatus, MedplumClient, OperationOutcomeError } from "@medplum/core"
import { beforeAll, describe, expect, it } from "vitest"
import { HTTP_FORBIDDEN, HTTP_GONE, HTTP_NOT_FOUND } from "../../failure"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf, tokenOf } from "../../identifiers"
import { MedplumBinaryStore } from "../../medplum-binary-store"
import { MedplumClinicalRecordStore } from "../../medplum-clinical-record-store"
import { MedplumClosedRecordReader } from "../../medplum-closed-record-reader"
import { MedplumImageHistory } from "../../medplum-image-history"

// Q-040
const INSTANCE_BASE = "https://vulna-live-test.invalid/fhir"
const DEPARTMENT = { id: "d1000000-0000-4000-8000-000000000001", code: "LIVE-A" }
const OTHER_DEPARTMENT = { id: "d1000000-0000-4000-8000-000000000002", code: "LIVE-B" }
const PATIENT_ID = "d1000000-0000-4000-8000-000000000010"
const ENCOUNTER_ID = "d1000000-0000-4000-8000-000000000020"
const FINDING_ID = "d1000000-0000-4000-8000-000000000030"
const WOUND_RECORD = "d1000000-0000-4000-8000-000000000040"
const SCAN_RECORD = "d1000000-0000-4000-8000-000000000041"
const DRAFT_RECORD = "d1000000-0000-4000-8000-000000000042"
const DRAFT_FINDING_ID = "d1000000-0000-4000-8000-000000000031"
const DOCUMENT_ID = "d1000000-0000-4000-8000-000000000050"
const DEVICE_ID = "d1000000-0000-4000-8000-000000000060"
const WOUND_TYPE_CHANGE_ID = "d1000000-0000-4000-8000-000000000070"
const STUDY_UID = "2.25.909090909090909090909090909090"
const MISSING_MEMBERSHIP = "00000000-0000-4000-8000-000000000000"

const clinician: ClinicalActor = {
	userId: "d1000000-0000-4000-8000-000000000101",
	displayName: "Živý Test A",
	department: DEPARTMENT,
	roles: ["clinician"],
}
const otherClinician: ClinicalActor = {
	userId: "d1000000-0000-4000-8000-000000000102",
	displayName: "Živý Test B",
	department: OTHER_DEPARTMENT,
	roles: ["clinician"],
}

function required(name: string): string {
	const value = process.env[name]
	if (value === undefined || value === "") {
		throw new Error(`the live test of the store needs ${name}`)
	}
	return value
}

const settings = {
	baseUrl: process.env.CLINICAL_RECORD_URL ?? "http://127.0.0.1:8103/",
	clientId: required("CLINICAL_RECORD_CLIENT_ID"),
	clientSecret: required("CLINICAL_RECORD_CLIENT_SECRET"),
	canonicalBase: DEFAULT_CANONICAL_BASE,
	instanceBaseUri: INSTANCE_BASE,
}
const store = new MedplumClinicalRecordStore({ ...settings, serverVersion: "live-test" })
const history = new MedplumImageHistory(settings)
// ADR-054 bod 4, CAP-012-R30
const workerCredential = {
	clientId: required("CLINICAL_RECORD_WORKER_CLIENT_ID"),
	clientSecret: required("CLINICAL_RECORD_WORKER_CLIENT_SECRET"),
}
const worker = new MedplumClosedRecordReader({ ...settings, ...workerCredential })
const workerBinaries = new MedplumBinaryStore({ ...settings, ...workerCredential })
// CAP-026-R19, dorucovaci-jadro.md 6
const retentionBinaries = new MedplumBinaryStore({
	...settings,
	clientId: required("CLINICAL_RECORD_RETENTION_CLIENT_ID"),
	clientSecret: required("CLINICAL_RECORD_RETENTION_CLIENT_SECRET"),
})
const REMOVED_STATUSES = [HTTP_NOT_FOUND, HTTP_GONE]
const systems = identifierSystemsOf(DEFAULT_CANONICAL_BASE)
const HIDDEN_STATUSES = [HTTP_FORBIDDEN, HTTP_NOT_FOUND]

async function workerClient(): Promise<MedplumClient> {
	const client = new MedplumClient({ baseUrl: settings.baseUrl, cacheTime: 0 })
	await client.startClientLogin(workerCredential.clientId, workerCredential.clientSecret)
	return client
}

async function statusOf(work: Promise<unknown>): Promise<number | undefined> {
	try {
		await work
		return undefined
	} catch (error) {
		return error instanceof OperationOutcomeError ? getStatus(error.outcome) : undefined
	}
}

function draftFinding(findingId: string, acquisitionId: string, patientResourceId: string): ClinicalDraftFinding {
	return {
		findingId,
		acquisitionId,
		patientResourceId,
		department: DEPARTMENT,
		site: {
			regionCode: "181553006",
			laterality: "R",
			surface: "anterior",
			view: "anterior",
			x: 0.25,
			y: 0.75,
			bodyDiagramVersion: "2",
		},
	}
}

function closureOf(acquisitionId: string, patientResourceId: string, encounterResourceId: string): ClinicalClosure {
	return {
		acquisitionId,
		patientId: PATIENT_ID,
		patientResourceId,
		department: DEPARTMENT,
		startedAt: "2026-10-22T07:00:00.000Z",
		closedAt: "2026-10-22T07:10:00.000Z",
		author: { userId: clinician.userId, department: DEPARTMENT },
		station: { deviceId: DEVICE_ID, model: "Live test" },
		study: {
			encounterId: ENCOUNTER_ID,
			encounterResourceId,
			studyInstanceUid: STUDY_UID,
			started: "2026-10-22T07:00:00.000Z",
			department: DEPARTMENT,
		},
		series: {
			seriesInstanceUid: `${STUDY_UID}.${acquisitionId === WOUND_RECORD ? 1 : 2}`,
			number: acquisitionId === WOUND_RECORD ? 1 : 2,
			bodyRegion: undefined,
			laterality: null,
		},
	}
}

interface Written {
	reader: ClinicalReader
	otherReader: ClinicalReader
	patient: string
	encounter: string
	imagingStudy: string
	condition: string
	woundTypeObservation: string
	draftCondition: string
}

async function writtenRecords(): Promise<Written> {
	const reader = { membershipResourceId: await store.recordActor(clinician) }
	const otherReader = { membershipResourceId: await store.recordActor(otherClinician) }
	const { patient, encounter } = await store.recordEncounter({
		patient: {
			patientId: PATIENT_ID,
			familyName: "Syntetická",
			givenName: "Pacientka",
			birthDate: undefined,
			sex: undefined,
			identifiers: [],
			demographicsRevision: 1,
		},
		encounter: {
			encounterId: ENCOUNTER_ID,
			status: ENCOUNTER_STATUS.IN_PROGRESS,
			date: "2026-10-22",
			startedAt: "2026-10-22T07:00:00.000Z",
			statusChangedAt: "2026-10-22T07:00:00.000Z",
			studyInstanceUid: STUDY_UID,
			department: DEPARTMENT,
			completedByUserId: undefined,
		},
	})
	const finding = draftFinding(FINDING_ID, WOUND_RECORD, patient)
	const ids = await store.recordDraftFinding(finding)
	const woundType: ClinicalDraftWoundType = {
		findingId: FINDING_ID,
		acquisitionId: WOUND_RECORD,
		patientResourceId: patient,
		conditionResourceId: ids.condition,
		department: DEPARTMENT,
		woundTypeCode: "leg-ulcer",
		woundTypeName: "Bércový vřed",
	}
	const woundTypeObservation = await store.recordDraftWoundType(woundType)
	const assessment: ClinicalDraftAssessment = {
		acquisitionId: WOUND_RECORD,
		patientResourceId: patient,
		conditionResourceId: ids.condition,
		bodyStructureResourceId: ids.bodyStructure,
		department: DEPARTMENT,
		healingPhaseCode: "granulating",
		healingPhaseName: "Granulace",
		description: "Synteticky živý test",
	}
	await store.recordDraftAssessment(assessment)
	const closed = await store.recordWoundClosure({
		...closureOf(WOUND_RECORD, patient, encounter),
		firstRecord: { finding, woundType },
		assessment,
		closedWoundType: { code: "leg-ulcer", name: "Bércový vřed" },
	})
	const scan = closureOf(SCAN_RECORD, patient, encounter)
	await store.recordDraftDocument({
		documentId: DOCUMENT_ID,
		acquisitionId: SCAN_RECORD,
		department: DEPARTMENT,
		patientResourceId: patient,
		study: scan.study,
		series: scan.series,
	})
	await store.recordScanClosure({
		...scan,
		documentId: DOCUMENT_ID,
		title: { code: undefined, text: "Syntetická zpráva" },
		pageCount: 2,
	})
	const draft = await store.recordDraftFinding(draftFinding(DRAFT_FINDING_ID, DRAFT_RECORD, patient))
	await store.recordDraftAssessment({
		...assessment,
		acquisitionId: DRAFT_RECORD,
		conditionResourceId: draft.condition,
		bodyStructureResourceId: draft.bodyStructure,
	})
	return {
		reader,
		otherReader,
		patient,
		encounter,
		imagingStudy: closed.imagingStudy,
		condition: ids.condition,
		woundTypeObservation,
		draftCondition: draft.condition,
	}
}

async function patientRecordsOf(reader: ClinicalReader, patientResourceId: string): Promise<HistoryRecords> {
	return {
		...(await history.closedWoundsOfPatient(reader, patientResourceId)),
		scans: await history.closedScansOfPatient(reader, patientResourceId),
	}
}

function acquisitionsOf(records: HistoryRecords): string[] {
	return [...records.wounds, ...records.scans].map((record) => record.acquisitionId).sort()
}

// CAP-003-S03, CAP-020-R16, ADR-053 bod 3, ADR-053 bod 10, ADR-054 bod 2
describe("clinical reads on behalf of the user against the real store", () => {
	let written: Written

	beforeAll(async () => {
		written = await writtenRecords()
	})

	it("CAP-020-S08 shows the clinician the closed records of the department with their content", async () => {
		const records = await patientRecordsOf(written.reader, written.patient)

		expect(acquisitionsOf(records)).toEqual([WOUND_RECORD, SCAN_RECORD])
		expect(records.findings).toEqual([{ findingId: FINDING_ID, woundTypeCode: "leg-ulcer" }])
		expect(records.wounds).toEqual([
			{
				acquisitionId: WOUND_RECORD,
				findingId: FINDING_ID,
				site: { regionCode: "181553006", laterality: "R", view: "anterior", x: 0.25, y: 0.75, bodyDiagramVersion: "2" },
				healingPhaseCode: "granulating",
				description: "Synteticky živý test",
				closedWoundTypeCode: "leg-ulcer",
			},
		])
		expect(records.scans).toEqual([
			expect.objectContaining({
				acquisitionId: SCAN_RECORD,
				documentId: DOCUMENT_ID,
				title: { code: undefined, text: "Syntetická zpráva" },
				pageCount: 2,
			}),
		])
	})

	it("CAP-003-S03 CAP-020-S09 shows a clinician of another department nothing of it", async () => {
		const records = await patientRecordsOf(written.otherReader, written.patient)

		expect(records).toEqual({ findings: [], wounds: [], scans: [] })
	})

	it("CAP-020-S14 answers a record of another department exactly like a missing one", async () => {
		const outside = await history.closedRecord(written.otherReader, {
			acquisitionId: WOUND_RECORD,
			kind: ACQUISITION_KIND.PHOTO,
		})
		const missing = await history.closedRecord(written.reader, {
			acquisitionId: "d1000000-0000-4000-8000-000000000099",
			kind: ACQUISITION_KIND.PHOTO,
		})

		expect(outside).toEqual(missing)
	})

	it("CAP-020-S21 CAP-020-S23 never shows a draft, not even to its department", async () => {
		const records = await patientRecordsOf(written.reader, written.patient)
		const draft = await history.closedRecord(written.reader, {
			acquisitionId: DRAFT_RECORD,
			kind: ACQUISITION_KIND.PHOTO,
		})

		expect(acquisitionsOf(records)).not.toContain(DRAFT_RECORD)
		expect(records.findings.map((finding) => finding.findingId)).not.toContain(DRAFT_FINDING_ID)
		expect(draft).toEqual({ findings: [], wounds: [], scans: [] })
	})

	it("CAP-014-S24 counts the closed records of the visit for its department only", async () => {
		const visits = [{ encounterResourceId: written.encounter, imagingStudyResourceId: written.imagingStudy }]

		expect([...(await history.closedAcquisitionsOfEncounters(written.reader, visits))].sort()).toEqual([
			WOUND_RECORD,
			SCAN_RECORD,
		])
		expect(await history.closedAcquisitionsOfEncounters(written.otherReader, visits)).toEqual([])
	})

	it("ADR-054 bod 4 lets the worker read the closed wound record for the DICOM assembly", async () => {
		expect(await worker.closedWoundRecord(WOUND_RECORD)).toEqual({
			acquisitionId: WOUND_RECORD,
			patientResourceId: written.patient,
			study: {
				patientResourceId: written.patient,
				studyInstanceUid: STUDY_UID,
				series: expect.arrayContaining([{ seriesInstanceUid: `${STUDY_UID}.1`, number: 1 }]),
			},
			findingId: FINDING_ID,
			site: { regionCode: "181553006", laterality: "R", view: "anterior", x: 0.25, y: 0.75, bodyDiagramVersion: "2" },
			healingPhaseCode: "granulating",
			closedWoundTypeCode: "leg-ulcer",
			description: "Synteticky živý test",
		})
	})

	it("ADR-054 bod 4 lets the worker read the closed scan with its title", async () => {
		expect(await worker.closedScanRecord(SCAN_RECORD)).toEqual(
			expect.objectContaining({
				acquisitionId: SCAN_RECORD,
				patientResourceId: written.patient,
				documentId: DOCUMENT_ID,
				title: { code: undefined, text: "Syntetická zpráva" },
			}),
		)
	})

	it("ADR-052 bod 5 CAP-012-R30 shows the worker no draft, not even by its id (negative)", async () => {
		const client = await workerClient()

		expect(await worker.closedWoundRecord(DRAFT_RECORD)).toBeUndefined()
		const draftAssessments = await client.searchResources("Observation", {
			identifier: tokenOf(systems.acquisition, DRAFT_RECORD),
		})
		expect(draftAssessments).toHaveLength(0)
		expect(await client.readResource("Condition", written.condition)).toMatchObject({ id: written.condition })
		expect(HIDDEN_STATUSES).toContain(await statusOf(client.readResource("Condition", written.draftCondition)))
	})

	it("CAP-012-R30 shows the worker no other observation than the closed assessment (negative)", async () => {
		const client = await workerClient()

		expect(await client.searchResources("Observation", { _id: written.woundTypeObservation })).toHaveLength(0)
		expect(HIDDEN_STATUSES).toContain(await statusOf(client.readResource("Observation", written.woundTypeObservation)))
	})

	it("CAP-012-R30 lets the worker write no clinical resource and read no patient (negative)", async () => {
		const client = await workerClient()
		const condition = await client.readResource("Condition", written.condition)

		expect(
			await statusOf(client.createResource({ resourceType: "Observation", status: "final", code: { text: "worker" } })),
		).toBe(HTTP_FORBIDDEN)
		expect(await statusOf(client.updateResource({ ...condition, note: [{ text: "worker" }] }))).toBe(HTTP_FORBIDDEN)
		expect(await statusOf(client.searchResources("Patient", { _id: written.patient }))).toBe(HTTP_FORBIDDEN)
	})

	it("CAP-020-R01 reads the timeline of the finding of the department", async () => {
		expect(acquisitionsOf(await history.closedRecordsOfFinding(written.reader, written.condition))).toEqual([
			WOUND_RECORD,
		])
		expect(await history.closedRecordsOfFinding(written.otherReader, written.condition)).toEqual({
			findings: [],
			wounds: [],
			scans: [],
		})
	})

	it("CAP-020-S25 amends the one wound type of the finding and keeps the type the record closed with", async () => {
		const observation = await store.recordWoundTypeChange({
			changeId: WOUND_TYPE_CHANGE_ID,
			findingId: FINDING_ID,
			patientId: PATIENT_ID,
			patientResourceId: written.patient,
			conditionResourceId: written.condition,
			department: DEPARTMENT,
			woundTypeCode: "pressure-ulcer",
			woundTypeName: "Dekubitus",
			changedAt: "2026-10-22T08:00:00.000Z",
			author: { userId: clinician.userId, department: DEPARTMENT },
		})
		const records = await history.closedRecordsOfFinding(written.reader, written.condition)

		expect(observation).toBe(written.woundTypeObservation)
		expect(records.findings).toEqual([{ findingId: FINDING_ID, woundTypeCode: "pressure-ulcer" }])
		expect(records.wounds.map((wound) => wound.closedWoundTypeCode)).toEqual(["leg-ulcer"])
		expect(await history.closedRecordsOfFinding(written.otherReader, written.condition)).toEqual({
			findings: [],
			wounds: [],
			scans: [],
		})
	})

	it("CAP-021-R28 adds the confirmed instances once with one delivery provenance and makes the study available", async () => {
		const seriesInstanceUid = `${STUDY_UID}.1`
		const delivery = {
			acquisitionId: WOUND_RECORD,
			patientId: PATIENT_ID,
			study: { encounterId: ENCOUNTER_ID },
			instances: [
				{
					seriesInstanceUid,
					sopClassUid: "1.2.840.10008.5.1.4.1.1.77.1.4",
					sopInstanceUid: `${STUDY_UID}.1.1`,
					number: 1,
					title: "ORIGINAL\\PRIMARY",
					description: undefined,
					seriesDescription: "Rána 1 · živý test",
				},
			],
			createdAt: "2026-10-22T07:12:00.000Z",
			confirmedAt: "2026-10-22T07:13:00.000Z",
		}
		const admin = new MedplumClient({ baseUrl: settings.baseUrl, cacheTime: 0 })
		await admin.startClientLogin(settings.clientId, settings.clientSecret)

		expect(await store.recordDelivery(delivery)).toBe(written.imagingStudy)
		await store.recordDelivery(delivery)
		const study = await admin.readResource("ImagingStudy", written.imagingStudy)
		const provenances = await admin.searchResources("Provenance", {
			_tag: tokenOf(systems.provenanceKeyTag, `acquisition:${WOUND_RECORD}:delivery-confirmed`),
		})

		expect(study.status).toBe("available")
		expect(study.series?.find((series) => series.uid === seriesInstanceUid)).toMatchObject({
			description: "Rána 1 · živý test",
			numberOfInstances: 1,
			instance: [{ uid: `${STUDY_UID}.1.1`, number: 1, title: "ORIGINAL\\PRIMARY" }],
		})
		expect(study).toMatchObject({ numberOfSeries: 1, numberOfInstances: 1 })
		expect(provenances).toHaveLength(1)
		expect(provenances[0]).toMatchObject({ occurredDateTime: "2026-10-22T07:12:00.000Z" })
	})

	it("ADR-053 (doplnění 2026-09-24) bod 3 fails closed for a membership the store does not know", async () => {
		const failure = await history
			.closedWoundsOfPatient({ membershipResourceId: MISSING_MEMBERSHIP }, written.patient)
			.catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
	})
})

// CAP-026-R19, CAP-026-S17, dorucovaci-jadro.md 6, backend.md 3.1 T8, ADR-050 bod 17
describe("retention of a Binary against the real store", () => {
	let encounter: string

	beforeAll(async () => {
		encounter = (await writtenRecords()).encounter
	})

	async function uploadedBinary(): Promise<string> {
		const bytes = Buffer.from(`synthetic retention bytes ${Date.now()}`)
		return await workerBinaries.upload(Readable.from([bytes]), {
			contentType: "image/jpeg",
			ownerReference: `Encounter/${encounter}`,
		})
	}

	it("CAP-026-S17 removes the Binary with its versions by the retention credential", async () => {
		const binaryId = await uploadedBinary()
		const admin = new MedplumClient({ baseUrl: settings.baseUrl, cacheTime: 0 })
		await admin.startClientLogin(settings.clientId, settings.clientSecret)
		const [version] = (await admin.readHistory("Binary", binaryId)).entry ?? []
		const versionId = version?.resource?.meta?.versionId
		expect(versionId).toBeDefined()

		await retentionBinaries.removeWithVersions(binaryId)

		expect(REMOVED_STATUSES).toContain(await statusOf(admin.readResource("Binary", binaryId)))
		expect(REMOVED_STATUSES).toContain(await statusOf(admin.readVersion("Binary", binaryId, versionId ?? "")))
		await expect(retentionBinaries.removeWithVersions(binaryId)).resolves.toBeUndefined()
	})

	it("CAP-012-R30 lets the worker credential remove no Binary (negative)", async () => {
		const binaryId = await uploadedBinary()

		const failure = await workerBinaries.removeWithVersions(binaryId).catch((error: unknown) => error)

		expect(failure).toBeInstanceOf(ClinicalRecordStoreError)
		expect((failure as ClinicalRecordStoreError).failure).toBe(CLINICAL_RECORD_FAILURE.REJECTED)
		expect(await workerBinaries.sha256Of(binaryId)).toBeDefined()
	})
})
