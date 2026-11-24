import type {
	ClinicalAuthor,
	ClinicalDocumentTitle,
	ClinicalFileRendition,
	ClinicalRecordStorePort,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND } from "../constants/clinical-record.constants"
import type { ClinicalActorRepository } from "../repositories/clinical-actor.repository"
import type { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import type { FileResourceRepository } from "../repositories/file-resource.repository"
import type { ClinicalContentService } from "../services/clinical-content.service"
import type { ClinicalRenditionService } from "../services/clinical-rendition.service"
import { ScannedDocumentContentService } from "../services/scanned-document-content.service"
import type {
	ConfirmedRenditionRow,
	FileRenditionRow,
	ResourceLink,
	ScannedDocumentRow,
} from "../types/clinical-record.types"

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const PATIENT_ID = "22222222-2222-4222-8222-222222222222"
const ENCOUNTER_ID = "33333333-3333-4333-8333-333333333333"
const OPERATOR_ID = "44444444-4444-4444-8444-444444444444"
const DEPARTMENT = { id: "77777777-7777-4777-8777-777777777777", code: "KOC" }
const AUTHOR_DEPARTMENT = { id: "88888888-8888-4888-8888-888888888888", code: "DER" }
const CLOSED_AT = new Date("2026-11-02T09:30:00.000Z")
const SNAPSHOT = "isolation level repeatable read read only"
const TITLE: ClinicalDocumentTitle = { code: "discharge-report", text: "Propouštěcí zpráva" }
const PDF: FileRenditionRow = {
	binary_object_id: "object-pdf",
	size_bytes: 177_172,
	sha256: "a".repeat(64),
	clinical_record_binary_id: "binary-pdf",
	clinical_record_uploaded_at: "2026-11-02T09:31:00.000Z",
	buffer_deleted_at: null,
	retention_due_at: null,
}
const PDF_DELETED_AT = new Date("2026-12-21T10:00:00.000Z")

function documentRow(overrides: Partial<ScannedDocumentRow> = {}): ScannedDocumentRow {
	return {
		document_id: DOCUMENT_ID,
		acquisition_id: ACQUISITION_ID,
		patient_id: PATIENT_ID,
		encounter_id: ENCOUNTER_ID,
		department_id: DEPARTMENT.id,
		operator_user_id: OPERATOR_ID,
		closed_at: CLOSED_AT,
		page_count: 3,
		title_code: "discharge-report",
		title_text: null,
		series_instance_uid: "2.25.9",
		pdf: PDF,
		output_pdf_deleted_at: null,
		delivered_sop_instance_uid: null,
		delivered_title: null,
		delivered_language: null,
		delivered_created_at: null,
		...overrides,
	}
}

const LINKS: ReadonlyMap<string, string> = new Map([
	[`${FHIR_RESOURCE_TYPE.PATIENT}/${LOCAL_KIND.PATIENT}/${PATIENT_ID}`, "patient-1"],
	[`${FHIR_RESOURCE_TYPE.ENCOUNTER}/${LOCAL_KIND.ENCOUNTER}/${ENCOUNTER_ID}`, "encounter-1"],
	[`${FHIR_RESOURCE_TYPE.IMAGING_STUDY}/${LOCAL_KIND.IMAGING_STUDY}/${ENCOUNTER_ID}`, "study-1"],
])

function harness(row: ScannedDocumentRow | undefined, links: ReadonlyMap<string, string> = LINKS) {
	const isolations: string[] = []
	const remembered: ResourceLink[] = []
	const detached: string[] = []
	const renditionsBuilt: { row: ConfirmedRenditionRow; contentType: string }[] = []
	const database = {
		sql: {
			begin: async (...args: unknown[]) => {
				const work = args.at(-1) as (tx: never) => Promise<unknown>
				if (args.length > 1) {
					isolations.push(String(args[0]))
				}
				return await work({} as never)
			},
		},
	} as unknown as DatabaseService
	const files = {
		scannedDocument: async (_tx: never, documentId: string) => (documentId === DOCUMENT_ID ? row : undefined),
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
		departmentOf: async (_tx: never, departmentId: string | null) =>
			departmentId === DEPARTMENT.id ? DEPARTMENT : undefined,
	} as unknown as ClinicalActorRepository
	const content = {
		documentTitleOf: async (_tx: never, code: string | null) => (code === TITLE.code ? TITLE : undefined),
		authorAt: async (_tx: never, userId: string, moment: Date): Promise<ClinicalAuthor> => ({
			userId,
			department: userId === OPERATOR_ID && moment.getTime() === CLOSED_AT.getTime() ? AUTHOR_DEPARTMENT : undefined,
		}),
	} as unknown as ClinicalContentService
	const renditions = {
		renditionOf: async (confirmed: ConfirmedRenditionRow, contentType: string): Promise<ClinicalFileRendition> => {
			renditionsBuilt.push({ row: confirmed, contentType })
			return {
				binaryId: confirmed.clinical_record_binary_id,
				contentType,
				sizeBytes: confirmed.size_bytes,
				sha1Base64: "sha1",
				sha256: confirmed.sha256,
			}
		},
	} as unknown as ClinicalRenditionService
	const service = new ScannedDocumentContentService(database, files, linkRepository, actors, content, renditions)
	const store = {} as ClinicalRecordStorePort
	const writeOf = () => service.contentOf(DOCUMENT_ID, store)
	const contentOf = async () => (await writeOf())?.resource
	return { service, writeOf, contentOf, isolations, remembered, detached, renditionsBuilt }
}

describe("DocumentReference of a scanned document built from the server database CAP-021-R39", () => {
	it("CAP-021-R39 names the document by its title, author, closure date and page count and adds the confirmed PDF", async () => {
		const run = harness(documentRow())

		expect(await run.contentOf()).toEqual({
			acquisitionId: ACQUISITION_ID,
			documentId: DOCUMENT_ID,
			patientResourceId: "patient-1",
			department: DEPARTMENT,
			closedAt: CLOSED_AT.toISOString(),
			author: { userId: OPERATOR_ID, department: AUTHOR_DEPARTMENT },
			title: TITLE,
			pageCount: 3,
			study: { encounterResourceId: "encounter-1" },
			series: { seriesInstanceUid: "2.25.9" },
			studyResourceId: "study-1",
			pdf: {
				binaryId: "binary-pdf",
				contentType: "application/pdf",
				sizeBytes: 177_172,
				sha1Base64: "sha1",
				sha256: "a".repeat(64),
			},
		})
		expect(run.isolations).toEqual([SNAPSHOT])
	})

	it("CAP-021-R28 adds the title, language, creation and SOP Instance UID the archive confirmed", async () => {
		const run = harness(
			documentRow({
				delivered_sop_instance_uid: "2.25.77",
				delivered_title: "Propouštěcí zpráva",
				delivered_language: "cs",
				delivered_created_at: new Date("2026-11-09T10:15:30.250Z"),
			}),
		)

		expect(await run.contentOf()).toMatchObject({
			delivered: {
				sopInstanceUid: "2.25.77",
				title: "Propouštěcí zpráva",
				language: "cs",
				createdAt: "2026-11-09T10:15:30.250Z",
			},
		})
	})

	it("CAP-021-R36 builds nothing while the PDF is not confirmed in the clinical record", async () => {
		const run = harness(documentRow({ pdf: { ...PDF, clinical_record_uploaded_at: null } }))

		expect(await run.contentOf()).toBeUndefined()
		expect(run.renditionsBuilt).toEqual([])
	})

	it("CAP-021-R39 builds nothing for a document without a PDF", async () => {
		const run = harness(documentRow({ pdf: null }))

		expect(await run.contentOf()).toBeUndefined()
	})

	it("CAP-021-R36 builds nothing while the PDF has no Binary in the clinical record", async () => {
		const run = harness(documentRow({ pdf: { ...PDF, clinical_record_binary_id: null } }))

		expect(await run.contentOf()).toBeUndefined()
	})

	it("CAP-021-R39 builds nothing for a document the server does not hold", async () => {
		const run = harness(undefined)

		expect(await run.contentOf()).toBeUndefined()
	})

	it("CAP-021-R39 builds nothing for a document whose patient is not in the clinical record", async () => {
		const withoutPatient = new Map([...LINKS].filter(([key]) => !key.startsWith(`${FHIR_RESOURCE_TYPE.PATIENT}/`)))
		const run = harness(documentRow(), withoutPatient)

		expect(await run.contentOf()).toBeUndefined()
	})

	it("CAP-021-R39 builds nothing for a document whose visit has no study in the clinical record", async () => {
		const withoutStudy = new Map([...LINKS].filter(([key]) => !key.startsWith(`${FHIR_RESOURCE_TYPE.IMAGING_STUDY}/`)))
		const run = harness(documentRow(), withoutStudy)

		expect(await run.contentOf()).toBeUndefined()
	})

	it("datovy-model.md 13.2 remembers the DocumentReference of the document under the document", async () => {
		const run = harness(documentRow())

		await run.service.remember(DOCUMENT_ID, "document-1", [])

		expect(run.remembered).toEqual([
			{
				resourceType: FHIR_RESOURCE_TYPE.DOCUMENT_REFERENCE,
				localKind: LOCAL_KIND.DOCUMENT,
				localId: DOCUMENT_ID,
				resourceId: "document-1",
			},
		])
	})
})

describe("DocumentReference of a scanned document past its retention CAP-026-R20, ADR-050 bod 14", () => {
	it("CAP-026-R20 writes a PDF due for retention as kept only in the PACS and detaches it", async () => {
		const due = { ...PDF, buffer_deleted_at: "2026-11-20T10:00:00.000Z", retention_due_at: "2026-12-20T10:00:00.000Z" }
		const run = harness(documentRow({ pdf: due, delivered_sop_instance_uid: "2.25.90" }))

		const write = await run.writeOf()

		expect(write?.resource.pdf).toEqual({ contentType: "application/pdf", sha256: PDF.sha256 })
		expect(write?.detaching).toEqual(["object-pdf"])
		expect(run.renditionsBuilt).toEqual([])
	})

	it("CAP-026-R20 keeps writing a PDF removed by the retention as kept only in the PACS", async () => {
		const run = harness(documentRow({ pdf: null, output_pdf_deleted_at: PDF_DELETED_AT }))

		const write = await run.writeOf()

		expect(write?.resource.pdf).toEqual({ contentType: "application/pdf", sha256: undefined })
		expect(write?.detaching).toEqual([])
	})

	it("ADR-050 bod 14 marks the detached PDF together with the stored DocumentReference", async () => {
		const run = harness(documentRow())

		await run.service.remember(DOCUMENT_ID, "document-1", ["object-pdf"])

		expect(run.remembered).toHaveLength(1)
		expect(run.detached).toEqual(["object-pdf"])
	})
})
