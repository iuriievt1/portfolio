import {
	CLINICAL_FILE_KIND,
	type ClinicalFileRendition,
	type ClinicalImageResource,
	type ClinicalPageResource,
} from "@ansora/vulna-domain/ports"
import { describe, expect, it } from "vitest"
import { fileResourceOf, fileTokenOf } from "../file-resources"
import { DEFAULT_CANONICAL_BASE, identifierSystemsOf } from "../identifiers"

const CONTEXT = { systems: identifierSystemsOf(DEFAULT_CANONICAL_BASE), instanceBase: "https://fhir.mou.cz/vulna" }
const IG = DEFAULT_CANONICAL_BASE
const FILE_ID = "11111111-1111-4111-8111-111111111111"
const ACQUISITION_ID = "55555555-5555-4555-8555-555555555555"
const DEPARTMENT = { id: "33333333-3333-4333-8333-333333333333", code: "KOC" }
const SERIES_UID = "2.25.123"
const THUMBNAIL_EXTENSION = "http://hl7.org/fhir/StructureDefinition/documentreference-thumbnail"

function renditionOf(name: string): ClinicalFileRendition {
	return {
		binaryId: `binary-${name}`,
		contentType: "image/jpeg",
		sizeBytes: name.length,
		sha1Base64: `sha1-${name}`,
		sha256: `sha256-${name}`,
	}
}

const IMAGE: ClinicalImageResource = {
	kind: CLINICAL_FILE_KIND.IMAGE,
	fileId: FILE_ID,
	acquisitionId: ACQUISITION_ID,
	sequence: 2,
	department: DEPARTMENT,
	patientResourceId: "patient-1",
	encounterResourceId: "encounter-1",
	seriesInstanceUid: SERIES_UID,
	sopInstanceUid: undefined,
	original: renditionOf("original"),
	thumbnail: renditionOf("thumbnail"),
	viewingCopy: renditionOf("copy"),
	findingResourceId: "condition-1",
	assessmentResourceId: "observation-1",
	studyResourceId: "study-1",
}

const PAGE: ClinicalPageResource = {
	kind: CLINICAL_FILE_KIND.DOCUMENT_PAGE,
	fileId: FILE_ID,
	acquisitionId: ACQUISITION_ID,
	sequence: 1,
	department: DEPARTMENT,
	patientResourceId: "patient-1",
	encounterResourceId: "encounter-1",
	seriesInstanceUid: SERIES_UID,
	sopInstanceUid: undefined,
	original: renditionOf("original"),
	thumbnail: undefined,
	viewingCopy: undefined,
	documentResourceId: "document-1",
}

function attachmentOf(name: string) {
	return {
		contentType: "image/jpeg",
		url: `Binary/binary-${name}`,
		size: name.length,
		hash: `sha1-${name}`,
		extension: [{ url: `${IG}/StructureDefinition/attachment-sha256`, valueString: `sha256-${name}` }],
	}
}

describe("source of a wound photo CAP-021-R37, ADR-050 bod 13", () => {
	it("CAP-021-S30 writes one DocumentReference with the original, thumbnail and viewing copy as its attachments", () => {
		const resource = fileResourceOf(IMAGE, CONTEXT)

		expect(resource.content).toEqual([
			{
				extension: [{ url: THUMBNAIL_EXTENSION, valueBoolean: false }],
				attachment: {
					...attachmentOf("original"),
					extension: [
						...attachmentOf("original").extension,
						{ url: `${IG}/StructureDefinition/content-availability`, valueCode: "stored" },
					],
				},
			},
			{ extension: [{ url: THUMBNAIL_EXTENSION, valueBoolean: true }], attachment: attachmentOf("thumbnail") },
			{
				extension: [
					{ url: THUMBNAIL_EXTENSION, valueBoolean: false },
					{ url: `${IG}/StructureDefinition/attachment-kind`, valueCode: "viewing-copy" },
				],
				attachment: attachmentOf("copy"),
			},
		])
	})

	it("CAP-021-R37 carries our file, record and series identifiers, the file order and the photographic image type", () => {
		const resource = fileResourceOf(IMAGE, CONTEXT)

		expect(resource.type).toEqual({ coding: [{ system: "http://loinc.org", code: "72170-4" }] })
		expect(resource).toMatchObject({
			resourceType: "DocumentReference",
			status: "current",
			meta: { profile: [`${IG}/StructureDefinition/vulna-wound-photo`] },
			extension: [{ url: `${IG}/StructureDefinition/file-sequence`, valuePositiveInt: 2 }],
			category: [{ coding: [{ system: `${IG}/CodeSystem/vulna-image-kind`, code: "wound-photo" }] }],
			subject: { reference: "Patient/patient-1" },
		})
		expect(resource.identifier?.slice(0, 2)).toEqual([
			{ system: `${IG}/sid/image`, value: FILE_ID },
			{ system: `${IG}/sid/acquisition`, value: ACQUISITION_ID },
		])
		expect(resource.identifier?.[2]).toMatchObject({ value: `urn:oid:${SERIES_UID}` })
		expect(resource.meta?.tag).toContainEqual({ system: `${IG}/tag/department`, code: DEPARTMENT.id })
	})

	it("CAP-021-R37 links the photo to its encounter, finding, assessment and study", () => {
		expect(fileResourceOf(IMAGE, CONTEXT).context).toEqual({
			encounter: [{ reference: "Encounter/encounter-1" }],
			related: [
				{ reference: "Condition/condition-1" },
				{ reference: "Observation/observation-1" },
				{ reference: "ImagingStudy/study-1" },
			],
		})
		expect(fileResourceOf({ ...IMAGE, assessmentResourceId: undefined }, CONTEXT).context?.related).toEqual([
			{ reference: "Condition/condition-1" },
			{ reference: "ImagingStudy/study-1" },
		])
	})

	it("CAP-021-R37 points every attachment at a Binary inside the store, never at the Vulna server", () => {
		const urls = fileResourceOf(IMAGE, CONTEXT).content.map((content) => content.attachment.url)

		expect(urls.every((url) => url?.startsWith("Binary/"))).toBe(true)
	})
})

describe("source of a scanned page CAP-021-R37, CAP-021-R39", () => {
	it("CAP-021-S35 writes the page under its own profile and links it to its document", () => {
		const resource = fileResourceOf(PAGE, CONTEXT)

		expect(resource.meta?.profile).toEqual([`${IG}/StructureDefinition/vulna-document-page`])
		expect(resource.category).toEqual([
			{ coding: [{ system: `${IG}/CodeSystem/vulna-image-kind`, code: "document-page" }] },
		])
		expect(resource.type).toBeUndefined()
		expect(resource.identifier?.[0]).toEqual({ system: `${IG}/sid/document-page`, value: FILE_ID })
		expect(resource.context?.related).toEqual([{ reference: "DocumentReference/document-1" }])
		expect(resource.content).toHaveLength(1)
	})

	it("ADR-050 bod 10 writes a photo and a page over identifiers of their own kind", () => {
		expect(fileTokenOf(IMAGE, CONTEXT)).toBe(`${IG}/sid/image|${FILE_ID}`)
		expect(fileTokenOf(PAGE, CONTEXT)).toBe(`${IG}/sid/document-page|${FILE_ID}`)
	})
})

describe("the archive's identifier on the source of a file CAP-021-R28 ✓ integrace-dicom.md 5.9", () => {
	it("carries no masterIdentifier before the archive confirmed the instance", () => {
		expect(fileResourceOf(IMAGE, CONTEXT)).not.toHaveProperty("masterIdentifier")
	})

	it("carries the SOP Instance UID of the photo and of the page's document once confirmed", () => {
		for (const file of [IMAGE, PAGE]) {
			expect(fileResourceOf({ ...file, sopInstanceUid: "2.25.4004" }, CONTEXT).masterIdentifier).toEqual({
				system: "urn:ietf:rfc:3986",
				value: "urn:oid:2.25.4004",
			})
		}
	})
})

describe("source of a file kept only in the PACS CAP-026-R19, CAP-021-R37, datovy-model.md 13.4", () => {
	const ARCHIVED = {
		...IMAGE,
		original: { contentType: "image/jpeg", sha256: "sha256-original" },
		sopInstanceUid: "2.25.9",
	}

	it("CAP-026-S17 drops the link of the original and marks it archive-only while the thumbnail stays", () => {
		const resource = fileResourceOf({ ...ARCHIVED, viewingCopy: undefined }, CONTEXT)

		expect(resource.content?.[0]?.attachment).toEqual({
			contentType: "image/jpeg",
			extension: [
				{ url: `${IG}/StructureDefinition/attachment-sha256`, valueString: "sha256-original" },
				{ url: `${IG}/StructureDefinition/content-availability`, valueCode: "archive-only" },
			],
		})
		expect(resource.content?.map((content) => content.attachment.url)).toEqual([undefined, "Binary/binary-thumbnail"])
	})

	it("CAP-026-R19 refuses an original kept only in the PACS without the SOP Instance UID the archive confirmed", () => {
		expect(() => fileResourceOf({ ...ARCHIVED, sopInstanceUid: undefined }, CONTEXT)).toThrow(
			expect.objectContaining({ failure: "rejected" }),
		)
	})
})
