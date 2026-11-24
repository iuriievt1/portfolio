import { createHash } from "node:crypto"
import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { CLINICAL_FILE_KIND, type ClinicalRecordStorePort } from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type { FileResourceRepository } from "../repositories/file-resource.repository"
import { ClinicalRenditionService } from "../services/clinical-rendition.service"
import { FileResourceContentService } from "../services/file-resource-content.service"
import type { FileRenditionRow, FileResourceRow, ResourceLink } from "../types/clinical-record.types"

const FILE_ID = "11111111-1111-4111-8111-111111111111"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const PATIENT_ID = "22222222-2222-4222-8222-222222222222"
const ENCOUNTER_ID = "33333333-3333-4333-8333-333333333333"
const FINDING_ID = "44444444-4444-4444-8444-444444444444"
const DOCUMENT_ID = "66666666-6666-4666-8666-666666666666"
const DEPARTMENT = { id: "77777777-7777-4777-8777-777777777777", code: "KOC" }
const UPLOADED_AT = "2026-10-20T10:00:00.000Z"
const BUFFER_DELETED_AT = "2026-11-20T10:00:00.000Z"
const STORED_HASH = "hash read from the clinical record"
const RETENTION_DUE_AT = "2026-12-20T10:00:00.000Z"
const ORIGINAL_DELETED_AT = new Date("2026-12-21T10:00:00.000Z")
const SNAPSHOT = "isolation level repeatable read read only"

function renditionRow(name: string, overrides: Partial<FileRenditionRow> = {}): FileRenditionRow {
	return {
		binary_object_id: `object-${name}`,
		size_bytes: name.length,
		sha256: `sha256-${name}`,
		clinical_record_binary_id: `binary-${name}`,
		clinical_record_uploaded_at: UPLOADED_AT,
		buffer_deleted_at: null,
		retention_due_at: null,
		...overrides,
	}
}

function imageRow(overrides: Partial<FileResourceRow> = {}): FileResourceRow {
	return {
		file_id: FILE_ID,
		acquisition_id: ACQUISITION_ID,
		sequence: 2,
		patient_id: PATIENT_ID,
		encounter_id: ENCOUNTER_ID,
		department_id: DEPARTMENT.id,
		finding_id: FINDING_ID,
		document_id: null,
		series_instance_uid: "2.25.1",
		sop_instance_uid: null,
		original: renditionRow("original"),
		thumbnail: renditionRow("thumbnail"),
		viewing_copy: renditionRow("copy"),
		file_sha256: "sha256-file",
		original_deleted_at: null,
		...overrides,
	}
}

const LINKS: ReadonlyMap<string, string> = new Map([
	[`${FHIR_RESOURCE_TYPE.PATIENT}/${LOCAL_KIND.PATIENT}/${PATIENT_ID}`, "patient-1"],
	[`${FHIR_RESOURCE_TYPE.ENCOUNTER}/${LOCAL_KIND.ENCOUNTER}/${ENCOUNTER_ID}`, "encounter-1"],
	[`${FHIR_RESOURCE_TYPE.IMAGING_STUDY}/${LOCAL_KIND.IMAGING_STUDY}/${ENCOUNTER_ID}`, "study-1"],
	[`${FHIR_RESOURCE_TYPE.CONDITION}/${LOCAL_KIND.FINDING}/${FINDING_ID}`, "condition-1"],
	[`${FHIR_RESOURCE_TYPE.OBSERVATION}/${LOCAL_KIND.ASSESSMENT}/${ACQUISITION_ID}`, "observation-1"],
	[`${FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE}/${LOCAL_KIND.DOCUMENT}/${DOCUMENT_ID}`, "document-1"],
])

function sha1Base64Of(name: string): string {
	return createHash("sha1")
		.update(Buffer.from(`bytes of object-${name}`))
		.digest("base64")
}

function harness(
	row: FileResourceRow | undefined,
	links: ReadonlyMap<string, string> = LINKS,
	lostFromBuffer: readonly string[] = [],
) {
	const isolations: string[] = []
	const remembered: ResourceLink[] = []
	const detached: string[] = []
	const readsInTransaction: boolean[] = []
	const hashedBinaries: string[] = []
	let isInTransaction = false
	const database = {
		sql: {
			begin: async (...args: unknown[]) => {
				const work = args.at(-1) as (tx: never) => Promise<unknown>
				if (args.length > 1) {
					isolations.push(String(args[0]))
				}
				isInTransaction = true
				try {
					return await work({} as never)
				} finally {
					isInTransaction = false
				}
			},
		},
	} as unknown as DatabaseService
	const files = {
		find: async () => row,
		markDetached: async (_tx: never, binaryObjectIds: readonly string[]) => {
			detached.push(...binaryObjectIds)
		},
	} as unknown as FileResourceRepository
	const linkRepository = {
		resourceIdOf: async (_tx: never, link: Pick<ResourceLink, "resourceType" | "localKind" | "localId">) =>
			links.get(`${link.resourceType}/${link.localKind}/${link.localId}`),
		upsert: async (_tx: never, written: readonly ResourceLink[]) => {
			remembered.push(...written)
		},
	} as unknown as FhirResourceLinkRepository
	const actors = {
		departmentOf: async (_tx: never, departmentId: string | null) => (departmentId === null ? undefined : DEPARTMENT),
	} as unknown as ClinicalActorRepository
	const binaries = {
		isKept: async (binaryObjectId: string) => !lostFromBuffer.includes(binaryObjectId),
		read: async (binaryObjectId: string) => {
			readsInTransaction.push(isInTransaction)
			return Buffer.from(`bytes of ${binaryObjectId}`)
		},
	} as unknown as BinaryObjectService
	const store = {
		attachmentHashOf: async (binaryId: string) => {
			hashedBinaries.push(binaryId)
			return STORED_HASH
		},
	} as unknown as ClinicalRecordStorePort
	const service = new FileResourceContentService(
		database,
		files,
		linkRepository,
		actors,
		new ClinicalRenditionService(binaries),
	)
	const writeOf = (kind: Parameters<FileResourceContentService["contentOf"]>[0]) =>
		service.contentOf(kind, FILE_ID, store)
	const contentOf = async (kind: Parameters<FileResourceContentService["contentOf"]>[0]) =>
		(await writeOf(kind))?.resource
	return { service, writeOf, contentOf, isolations, remembered, detached, readsInTransaction, hashedBinaries }
}

describe("source of a photo built from the server database CAP-021-R37", () => {
	it("CAP-021-S30 links the photo to its patient, encounter, finding, assessment and study with every confirmed attachment", async () => {
		const run = harness(imageRow())

		const file = await run.contentOf(JOB_OBJECT_KIND.IMAGE)

		expect(file).toEqual({
			kind: CLINICAL_FILE_KIND.IMAGE,
			fileId: FILE_ID,
			acquisitionId: ACQUISITION_ID,
			sequence: 2,
			department: DEPARTMENT,
			patientResourceId: "patient-1",
			encounterResourceId: "encounter-1",
			seriesInstanceUid: "2.25.1",
			original: {
				binaryId: "binary-original",
				contentType: "image/jpeg",
				sizeBytes: 8,
				sha1Base64: sha1Base64Of("original"),
				sha256: "sha256-original",
			},
			thumbnail: expect.objectContaining({ binaryId: "binary-thumbnail", sha1Base64: sha1Base64Of("thumbnail") }),
			viewingCopy: expect.objectContaining({ binaryId: "binary-copy", sha1Base64: sha1Base64Of("copy") }),
			findingResourceId: "condition-1",
			assessmentResourceId: "observation-1",
			studyResourceId: "study-1",
		})
		expect(run.isolations).toEqual([SNAPSHOT])
	})

	it("CAP-021-R37 reads the bytes for the attachment hashes only after the snapshot of the database ends", async () => {
		const run = harness(imageRow())

		await run.contentOf(JOB_OBJECT_KIND.IMAGE)

		expect(run.readsInTransaction).toEqual([false, false, false])
	})

	it("CAP-026-R18 takes the attachment hash from the clinical record once the buffer copy is deleted", async () => {
		const run = harness(imageRow({ original: renditionRow("original", { buffer_deleted_at: BUFFER_DELETED_AT }) }))

		const file = await run.contentOf(JOB_OBJECT_KIND.IMAGE)

		expect(file?.original).toMatchObject({ sha1Base64: STORED_HASH })
		expect(file?.thumbnail?.sha1Base64).toBe(sha1Base64Of("thumbnail"))
		expect(run.hashedBinaries).toEqual(["binary-original"])
	})

	it("CAP-021-R36 takes the attachment hash from the clinical record when the buffer lost a confirmed upload", async () => {
		const run = harness(imageRow(), LINKS, ["object-original"])

		const file = await run.contentOf(JOB_OBJECT_KIND.IMAGE)

		expect(file?.original).toMatchObject({ sha1Base64: STORED_HASH })
		expect(run.hashedBinaries).toEqual(["binary-original"])
	})

	it("CAP-021-R37 attaches no rendition whose upload is not confirmed", async () => {
		const run = harness(
			imageRow({
				thumbnail: renditionRow("thumbnail", { clinical_record_uploaded_at: null }),
				viewing_copy: null,
			}),
		)

		const file = await run.contentOf(JOB_OBJECT_KIND.IMAGE)

		expect(file?.thumbnail).toBeUndefined()
		expect(file?.viewingCopy).toBeUndefined()
	})

	it("CAP-021-R37 builds no source before the original is confirmed in the store", async () => {
		const run = harness(imageRow({ original: renditionRow("original", { clinical_record_uploaded_at: null }) }))

		expect(await run.contentOf(JOB_OBJECT_KIND.IMAGE)).toBeUndefined()
	})

	it("builds no source of a photo whose finding is not in the clinical record", async () => {
		const links = new Map(LINKS)
		links.delete(`${FHIR_RESOURCE_TYPE.CONDITION}/${LOCAL_KIND.FINDING}/${FINDING_ID}`)
		const run = harness(imageRow(), links)

		expect(await run.contentOf(JOB_OBJECT_KIND.IMAGE)).toBeUndefined()
	})

	it("builds no source of a file that does not exist", async () => {
		const run = harness(undefined)

		expect(await run.contentOf(JOB_OBJECT_KIND.IMAGE)).toBeUndefined()
	})

	it("CAP-021-R28 names the source by the SOP Instance UID the archive confirmed", async () => {
		const run = harness(imageRow({ sop_instance_uid: "2.25.77" }))

		const file = await run.contentOf(JOB_OBJECT_KIND.IMAGE)

		expect(file).toMatchObject({ sopInstanceUid: "2.25.77" })
	})
})

describe("source of a scanned page built from the server database CAP-021-R37, CAP-021-R39", () => {
	it("CAP-021-S35 links the page to the DocumentReference of its document", async () => {
		const run = harness(imageRow({ finding_id: null, document_id: DOCUMENT_ID, department_id: null }))

		const file = await run.contentOf(JOB_OBJECT_KIND.DOCUMENT_PAGE)

		expect(file).toMatchObject({
			kind: CLINICAL_FILE_KIND.DOCUMENT_PAGE,
			documentResourceId: "document-1",
			department: undefined,
		})
	})

	it("CAP-021-R28 names the page by the SOP Instance UID of its delivered document", async () => {
		const run = harness(
			imageRow({ finding_id: null, document_id: DOCUMENT_ID, department_id: null, sop_instance_uid: "2.25.78" }),
		)

		const file = await run.contentOf(JOB_OBJECT_KIND.DOCUMENT_PAGE)

		expect(file).toMatchObject({ kind: CLINICAL_FILE_KIND.DOCUMENT_PAGE, sopInstanceUid: "2.25.78" })
	})

	it("datovy-model.md 13.2 remembers the stored source under the kind of the file", async () => {
		const run = harness(imageRow())

		await run.service.remember(JOB_OBJECT_KIND.IMAGE, FILE_ID, "document-reference-1", [])
		await run.service.remember(JOB_OBJECT_KIND.DOCUMENT_PAGE, FILE_ID, "document-reference-2", [])

		expect(run.remembered).toEqual([
			{
				resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
				localKind: LOCAL_KIND.IMAGE,
				localId: FILE_ID,
				resourceId: "document-reference-1",
			},
			{
				resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
				localKind: LOCAL_KIND.DOCUMENT_PAGE,
				localId: FILE_ID,
				resourceId: "document-reference-2",
			},
		])
	})
})

describe("source of a file past its retention CAP-026-R19, CAP-026-R20, ADR-050 bod 14", () => {
	it("CAP-026-S17 writes an original due for retention as kept only in the PACS and detaches it", async () => {
		const due = renditionRow("original", { buffer_deleted_at: BUFFER_DELETED_AT, retention_due_at: RETENTION_DUE_AT })
		const run = harness(imageRow({ original: due, sop_instance_uid: "2.25.77" }))

		const write = await run.writeOf(JOB_OBJECT_KIND.IMAGE)

		expect(write?.resource.original).toEqual({ contentType: "image/jpeg", sha256: "sha256-original" })
		expect(write?.resource.thumbnail).toMatchObject({ binaryId: "binary-thumbnail" })
		expect(write?.detaching).toEqual(["object-original"])
		expect(run.hashedBinaries).toEqual([])
	})

	it("CAP-026-R19 keeps writing an original removed by the retention as kept only in the PACS", async () => {
		const run = harness(imageRow({ original: null, original_deleted_at: ORIGINAL_DELETED_AT }))

		const write = await run.writeOf(JOB_OBJECT_KIND.IMAGE)

		expect(write?.resource.original).toEqual({ contentType: "image/jpeg", sha256: "sha256-file" })
		expect(write?.detaching).toEqual([])
	})

	it("CAP-026-S20 leaves out a thumbnail and a viewing copy due for retention and detaches them", async () => {
		const due = { buffer_deleted_at: BUFFER_DELETED_AT, retention_due_at: RETENTION_DUE_AT }
		const run = harness(
			imageRow({ thumbnail: renditionRow("thumbnail", due), viewing_copy: renditionRow("copy", due) }),
		)

		const write = await run.writeOf(JOB_OBJECT_KIND.IMAGE)

		expect(write?.resource.original).toMatchObject({ binaryId: "binary-original" })
		expect(write?.resource.thumbnail).toBeUndefined()
		expect(write?.resource.viewingCopy).toBeUndefined()
		expect(write?.detaching).toEqual(["object-thumbnail", "object-copy"])
	})

	it("CAP-021-R37 builds no source for an original neither stored nor removed by the retention", async () => {
		const run = harness(imageRow({ original: null }))

		expect(await run.writeOf(JOB_OBJECT_KIND.IMAGE)).toBeUndefined()
	})

	it("ADR-050 bod 14 marks the detached files only together with the stored source", async () => {
		const run = harness(imageRow())

		await run.service.remember(JOB_OBJECT_KIND.IMAGE, FILE_ID, "document-reference-1", ["object-original"])

		expect(run.remembered).toHaveLength(1)
		expect(run.detached).toEqual(["object-original"])
	})
})
