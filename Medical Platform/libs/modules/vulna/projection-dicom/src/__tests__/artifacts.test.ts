import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { BODY_VIEW, type BodyView, LATERALITY, type Laterality, normalizedPointInRegion } from "@ansora/contracts"
import {
	type BodySite,
	CURRENT_BODY_DIAGRAM,
	type DicomDocumentObject,
	type DicomImageObject,
	type DicomImageSource,
	dicomDocumentObjectOf,
	dicomImageObjectOf,
	uidOfUuid,
} from "@ansora/vulna-domain"
import { describe, expect, it } from "vitest"
import { documentArtifactOf, imageArtifactOf } from "../artifacts"
import type { ImplementationIdentity } from "../part10"
import { patientIdOf } from "../reading"
import { TRANSFER_SYNTAX, type TransferSyntax } from "../transfer-syntax"
import { find, hasEvenLengths, isAscending, type ReadElement, readPart10, textOf } from "./part10-reader"

const SCAN_PAGE = resolve(__dirname, "../../../../../../quality/data/synteticka-sada/scan/page-cs.jpg")
const PHONE_PHOTOS = resolve(__dirname, "../../../../../../quality/data/synteticka-sada/wounds/photos")
const BIRTH_NUMBER_SYSTEM = "https://ncez.mzcr.cz/fhir/sid/rcis"
const FINDING_ID = "00000000-0000-4000-8000-000000000002"
const LOWER_CHEST_WALL = "699915001"
const SOLE_OF_FOOT = "60496002"
const IDENTITY: ImplementationIdentity = {
	implementationClassUid: "2.25.123456789",
	implementationVersionName: "VULNA_1.0.0",
}
const ODD_PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n")
const EXPLICIT = TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN
const IMPLICIT = TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN
const JPEG_BASELINE = TRANSFER_SYNTAX.JPEG_BASELINE
const DCMJS_FRAGMENT_BYTES = 20 * 1024
const PREAMBLE_BYTES = 128
const BASIC_OFFSET_TABLE_OF_ONE_FRAME = [0, 0, 0, 0]
const PAD = 0
// ITU-T T.81 B.1.1.3, B.1.1.4
const MARKER = 0xff
const EXIF = 0xe1
const START_OF_SCAN = 0xda
const START_OF_IMAGE_BYTES = 2
const MARKER_BYTES = 2
const LENGTH_HIGH_BYTE = 256

// DICOM PS3.6 6, 7
const TAG = {
	FILE_META_INFORMATION_GROUP_LENGTH: 0x00_02_00_00,
	FILE_META_INFORMATION_VERSION: 0x00_02_00_01,
	MEDIA_STORAGE_SOP_CLASS_UID: 0x00_02_00_02,
	MEDIA_STORAGE_SOP_INSTANCE_UID: 0x00_02_00_03,
	TRANSFER_SYNTAX_UID: 0x00_02_00_10,
	IMPLEMENTATION_CLASS_UID: 0x00_02_00_12,
	IMPLEMENTATION_VERSION_NAME: 0x00_02_00_13,
	SOP_INSTANCE_UID: 0x00_08_00_18,
	CODE_VALUE: 0x00_08_01_00,
	ANATOMIC_REGION_SEQUENCE: 0x00_08_22_18,
	ANATOMIC_REGION_MODIFIER_SEQUENCE: 0x00_08_22_20,
	ISSUER_OF_PATIENT_ID: 0x00_10_00_21,
	LATERALITY: 0x00_20_00_60,
	PLANAR_CONFIGURATION: 0x00_28_00_06,
	ROWS: 0x00_28_00_10,
	COLUMNS: 0x00_28_00_11,
	ACQUISITION_CONTEXT_SEQUENCE: 0x00_40_05_55,
	CONCEPT_NAME_CODE_SEQUENCE: 0x00_40_a0_43,
	ENCAPSULATED_DOCUMENT: 0x00_42_00_11,
	ENCAPSULATED_DOCUMENT_LENGTH: 0x00_42_00_15,
	PIXEL_DATA: 0x7f_e0_00_10,
} as const

const COMMON = {
	assembly: {
		builtAt: new Date("2026-11-05T13:45:10Z"),
		language: "cs",
		softwareVersion: "1.0.0",
		patientIdSystem: BIRTH_NUMBER_SYSTEM,
	},
	patient: {
		familyName: undefined,
		givenName: undefined,
		birthDate: undefined,
		sex: undefined,
		identifiers: [{ system: BIRTH_NUMBER_SYSTEM, value: "7001011234", issuer: undefined, validUntil: undefined }],
	},
	encounter: {
		studyInstanceUid: "2.25.11",
		studyId: "2026-000123",
		accessionNumber: undefined,
		date: "2026-11-05",
		startedAt: new Date("2026-11-05T09:12:00Z"),
	},
	series: { seriesInstanceUid: "2.25.22", seriesNumber: 1 },
	operator: { familyName: "Nováková", givenName: "Jana" },
	station: { hardwareId: "tHg7xQ2kP9aLmN3vR8sW1yZ4bC6dE0fG2hJ5kL7mN9p" },
	instance: { sopInstanceUid: "2.25.44", instanceNumber: 1, acquiredAt: new Date("2026-11-05T09:15:30Z") },
}

function siteAt(regionCode: string, view: BodyView, laterality: Laterality): BodySite {
	const drawn = CURRENT_BODY_DIAGRAM.views[view]
	const point = drawn === undefined ? undefined : normalizedPointInRegion(view, drawn, regionCode, laterality)
	if (point === undefined) {
		throw new Error(`no point of ${regionCode} in the ${view} view`)
	}
	return { regionCode, laterality, view, ...point, bodyDiagramVersion: CURRENT_BODY_DIAGRAM.version }
}

function imageObject(change: Partial<DicomImageSource> = {}): DicomImageObject {
	return dicomImageObjectOf({
		...COMMON,
		wound: {
			findingId: FINDING_ID,
			woundNumber: 2,
			bodySite: siteAt(LOWER_CHEST_WALL, BODY_VIEW.ANTERIOR, LATERALITY.LEFT),
		},
		assessment: {
			woundTypeNames: { cs: "Dekubitus", en: "Pressure injury" },
			healingPhaseNames: undefined,
			description: undefined,
		},
		editKind: "rotation",
		jpeg: new Uint8Array(readFileSync(SCAN_PAGE)),
		...change,
	})
}

function documentObject(pdf = ODD_PDF): DicomDocumentObject {
	return dicomDocumentObjectOf({ ...COMMON, title: { text: "Propouštěcí zpráva" }, pdf })
}

function only<T>(values: readonly T[]): T {
	expect(values).toHaveLength(1)
	return values[0] as T
}

function required(element: ReadElement | undefined): ReadElement {
	expect(element).toBeDefined()
	return element as ReadElement
}

function imageFile(object = imageObject()) {
	return readPart10(only(imageArtifactOf(object, [JPEG_BASELINE], IDENTITY)).part10)
}

function expectElements(dataset: readonly ReadElement[], expected: readonly [number, string, string][]): void {
	for (const [tag, vr, value] of expected) {
		const element = required(find(dataset, tag))
		expect([tag.toString(16), element.vr, textOf(element)]).toEqual([tag.toString(16), vr, value])
	}
}

function expectEmpty(dataset: readonly ReadElement[], tags: readonly number[]): void {
	for (const tag of tags) {
		expect([tag.toString(16), required(find(dataset, tag)).value.length]).toEqual([tag.toString(16), 0])
	}
}

function sha256(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex")
}

// DICOM PS3.10 7.1, integrace-dicom.md 5.0, dorucovaci-jadro.md 3, ADR-017
describe("P10 file of an artifact", () => {
	it("integrace-dicom.md 5.0 has the preamble, DICM and the file meta information with our implementation", () => {
		const read = imageFile()

		expect(read.preamble.equals(Buffer.alloc(PREAMBLE_BYTES))).toBe(true)
		expect(read.prefix).toBe("DICM")
		expect(read.meta.map((element) => element.tag)).toEqual([
			TAG.FILE_META_INFORMATION_GROUP_LENGTH,
			TAG.FILE_META_INFORMATION_VERSION,
			TAG.MEDIA_STORAGE_SOP_CLASS_UID,
			TAG.MEDIA_STORAGE_SOP_INSTANCE_UID,
			TAG.TRANSFER_SYNTAX_UID,
			TAG.IMPLEMENTATION_CLASS_UID,
			TAG.IMPLEMENTATION_VERSION_NAME,
		])
		expect([...required(find(read.meta, TAG.FILE_META_INFORMATION_VERSION)).value]).toEqual([0, 1])
		expectElements(read.meta, [
			[TAG.MEDIA_STORAGE_SOP_CLASS_UID, "UI", "1.2.840.10008.5.1.4.1.1.77.1.4"],
			[TAG.MEDIA_STORAGE_SOP_INSTANCE_UID, "UI", "2.25.44"],
			[TAG.TRANSFER_SYNTAX_UID, "UI", JPEG_BASELINE],
			[TAG.IMPLEMENTATION_CLASS_UID, "UI", "2.25.123456789"],
			[TAG.IMPLEMENTATION_VERSION_NAME, "SH", "VULNA_1.0.0"],
		])
		expect(required(find(read.meta, TAG.MEDIA_STORAGE_SOP_INSTANCE_UID)).value.toString("latin1")).toBe("2.25.44\0")
	})

	it("CAP-012-R17 leaves the Implementation Version Name out when the configuration has none", () => {
		const variant = only(
			imageArtifactOf(imageObject(), [JPEG_BASELINE], { ...IDENTITY, implementationVersionName: undefined }),
		)

		expect(find(readPart10(variant.part10).meta, TAG.IMPLEMENTATION_VERSION_NAME)).toBeUndefined()
	})

	it("CAP-021-R06 carries the SHA-256 of the dataset after the file meta information", () => {
		const variant = only(imageArtifactOf(imageObject(), [JPEG_BASELINE], IDENTITY))

		expect(variant.datasetSha256).toBe(sha256(variant.part10.subarray(readPart10(variant.part10).datasetOffset)))
	})

	it("CAP-021-R06 builds the same bytes from the same record", () => {
		const first = only(imageArtifactOf(imageObject(), [JPEG_BASELINE], IDENTITY))
		const second = only(imageArtifactOf(imageObject(), [JPEG_BASELINE], IDENTITY))

		expect(Buffer.compare(first.part10, second.part10)).toBe(0)
	})

	it("integrace-dicom.md 11.3 writes every element in ascending tag order and of even length, inside items too", () => {
		const files = [
			imageFile(),
			...documentArtifactOf(documentObject(), [EXPLICIT, IMPLICIT], IDENTITY).map((variant) =>
				readPart10(variant.part10),
			),
		]

		for (const { dataset } of files) {
			expect(isAscending(dataset)).toBe(true)
			expect(hasEvenLengths(dataset)).toBe(true)
		}
	})

	it.each<[string, readonly TransferSyntax[], RegExp]>([
		["no transfer syntax", [], /distinct transfer syntaxes/],
		["the same transfer syntax twice", [EXPLICIT, EXPLICIT], /distinct transfer syntaxes/],
		["JPEG Baseline", [JPEG_BASELINE], /not built in the transfer syntax 1\.2\.840\.10008\.1\.2\.4\.50/],
	])("integrace-dicom.md 3 does not build a document in %s (negative)", (_, transferSyntaxes, message) => {
		const object = documentObject()

		expect(() => documentArtifactOf(object, transferSyntaxes, IDENTITY)).toThrow(message)
	})

	it.each<[string, ImplementationIdentity, RegExp]>([
		["an Implementation Class UID that is not a UID", { ...IDENTITY, implementationClassUid: "veevoy" }, /Class UID/],
		["an Implementation Class UID under an unknown root", { ...IDENTITY, implementationClassUid: "9.99" }, /Class UID/],
		[
			"an Implementation Version Name longer than 16",
			{ ...IDENTITY, implementationVersionName: "VULNA_1.0.0-rc.123" },
			/Version Name/,
		],
		["an empty Implementation Version Name", { ...IDENTITY, implementationVersionName: "" }, /Version Name/],
		["an Implementation Version Name of spaces", { ...IDENTITY, implementationVersionName: "  " }, /Version Name/],
		[
			"an Implementation Version Name outside ISO 646",
			{ ...IDENTITY, implementationVersionName: "VULNA_čř" },
			/Version Name/,
		],
	])("DICOM PS3.10 7.1, CAP-012-R17 refuses %s from the configuration (negative)", (_, identity, message) => {
		const object = documentObject()

		expect(() => documentArtifactOf(object, [EXPLICIT], identity)).toThrow(message)
	})
})

// integrace-dicom.md 3.1, 5, 5.5, CAP-021-R07, CAP-021-R09
describe("P10 file of a wound image", () => {
	it("integrace-dicom.md 5 writes every attribute of the mapping table with its VR and value", () => {
		const { dataset } = imageFile()

		expectElements(dataset, [
			[0x00_08_00_05, "CS", "ISO_IR 192"],
			[0x00_08_00_08, "CS", "DERIVED\\PRIMARY"],
			[0x00_08_00_12, "DA", "20261105"],
			[0x00_08_00_13, "TM", "144510"],
			[0x00_08_00_16, "UI", "1.2.840.10008.5.1.4.1.1.77.1.4"],
			[0x00_08_00_18, "UI", "2.25.44"],
			[0x00_08_00_20, "DA", "20261105"],
			[0x00_08_00_23, "DA", "20261105"],
			[0x00_08_00_2a, "DT", "20261105101530"],
			[0x00_08_00_30, "TM", "101200"],
			[0x00_08_00_33, "TM", "101530"],
			[0x00_08_00_60, "CS", "XC"],
			[0x00_08_00_70, "LO", "veevoy"],
			[0x00_08_10_10, "SH", "tHg7xQ2kP9aLmN3v"],
			[0x00_08_10_3e, "LO", "Rána 2 · Dolní část hrudní stěny (pod prsem) · levá strana"],
			[0x00_08_10_70, "PN", "Nováková^Jana"],
			[0x00_08_10_90, "LO", "Ansora Vulna Server"],
			[0x00_08_21_11, "ST", "Otočeno pořizovatelem před uzavřením záznamu"],
			[0x00_10_00_20, "LO", "7001011234"],
			[0x00_18_00_15, "CS", "CHEST"],
			[0x00_18_10_20, "LO", "1.0.0"],
			[0x00_20_00_0d, "UI", "2.25.11"],
			[0x00_20_00_0e, "UI", "2.25.22"],
			[0x00_20_00_10, "SH", "2026-000123"],
			[0x00_20_00_11, "IS", "1"],
			[0x00_20_00_13, "IS", "1"],
			[
				0x00_20_40_00,
				"LT",
				"Rána 2 · Dolní část hrudní stěny (pod prsem) · levá strana pacienta · zepředu\r\nTyp rány: Dekubitus",
			],
			[0x00_28_00_04, "CS", "YBR_FULL_422"],
			[0x00_28_03_01, "CS", "NO"],
			[0x00_28_21_10, "CS", "01"],
			[0x00_28_21_14, "CS", "ISO_10918_1"],
			[0x00_62_00_20, "UT", "Rána 2"],
			[0x00_62_00_21, "UI", uidOfUuid(FINDING_ID)],
		])
		expectEmpty(dataset, [0x00_08_00_50, 0x00_08_00_90, 0x00_10_00_10, 0x00_10_00_30, 0x00_10_00_40, 0x00_20_00_20])
		expect(find(dataset, TAG.ISSUER_OF_PATIENT_ID)).toBeUndefined()
		expect(required(find(dataset, TAG.ACQUISITION_CONTEXT_SEQUENCE)).items).toEqual([])
		for (const [tag, value] of [
			[0x00_28_00_02, 3],
			[0x00_28_00_06, 0],
			[0x00_28_00_10, 1754],
			[0x00_28_00_11, 1240],
			[0x00_28_01_00, 8],
			[0x00_28_01_01, 8],
			[0x00_28_01_02, 7],
			[0x00_28_01_03, 0],
		] as const) {
			const element = required(find(dataset, tag))
			expect([tag.toString(16), element.vr, element.value.readUInt16LE(0)]).toEqual([tag.toString(16), "US", value])
		}
	})

	it("DICOM PS3.5 6.2 pads an odd string with a space and an odd UID with NUL", () => {
		const { dataset } = imageFile()

		expect(required(find(dataset, 0x00_62_00_20)).value.toString("utf8")).toBe("Rána 2 ")
		expect(required(find(dataset, TAG.SOP_INSTANCE_UID)).value.toString("latin1")).toBe("2.25.44\0")
	})

	it("integrace-dicom.md 5.1 writes the issuer of the patient identifier when the model has one", () => {
		const issued = imageObject({
			patient: {
				...COMMON.patient,
				identifiers: [{ system: BIRTH_NUMBER_SYSTEM, value: "7001011234", issuer: "MOU", validUntil: undefined }],
			},
		})

		expectElements(imageFile(issued).dataset, [[TAG.ISSUER_OF_PATIENT_ID, "LO", "MOU"]])
	})

	it("CAP-021-S02 encapsulates the image bytes unchanged in one fragment after an offset table", () => {
		const object = imageObject()
		const fragments = required(find(imageFile(object).dataset, TAG.PIXEL_DATA)).fragments ?? []
		const [offsetTable, fragment] = fragments
		const { bytes } = object.stream

		expect(bytes.length).toBeGreaterThan(DCMJS_FRAGMENT_BYTES)
		expect(fragments).toHaveLength(2)
		expect([...(offsetTable ?? [])]).toEqual(BASIC_OFFSET_TABLE_OF_ONE_FRAME)
		expect(fragment?.subarray(0, bytes.length).equals(bytes)).toBe(true)
		expect(fragment?.length).toBe(bytes.length + (bytes.length % 2))
	})

	it("DICOM PS3.5 A.4 pads an odd image with one NUL byte at the end of its fragment", () => {
		const object = imageObject()
		const odd = { ...object, stream: { ...object.stream, bytes: object.stream.bytes.subarray(0, 1001) } }
		const [, fragment] = required(find(imageFile(odd).dataset, TAG.PIXEL_DATA)).fragments ?? []

		expect(fragment).toHaveLength(1002)
		expect(fragment?.[1001]).toBe(PAD)
	})

	it("DICOM PS3.3 10.5, C.7.3.1 writes Laterality only at a body part DICOM pairs, else the side as a modifier", () => {
		const chest = imageFile()
		const foot = imageFile(
			imageObject({
				wound: {
					findingId: FINDING_ID,
					woundNumber: 2,
					bodySite: siteAt(SOLE_OF_FOOT, BODY_VIEW.PLANTAR, LATERALITY.RIGHT),
				},
			}),
		)
		const modifierCodesOf = (dataset: readonly ReadElement[]) => {
			const [region] = required(find(dataset, TAG.ANATOMIC_REGION_SEQUENCE)).items ?? []
			const modifiers = required(find(region ?? [], TAG.ANATOMIC_REGION_MODIFIER_SEQUENCE)).items ?? []
			return modifiers.map((modifier) => textOf(find(modifier, TAG.CODE_VALUE)))
		}

		expect(find(chest.dataset, TAG.LATERALITY)).toBeUndefined()
		expect(modifierCodesOf(chest.dataset)).toEqual(["255549009", "7771000"])
		expectElements(foot.dataset, [
			[TAG.LATERALITY, "CS", "R"],
			[0x00_18_00_15, "CS", "FOOT"],
		])
		expect(modifierCodesOf(foot.dataset)).toEqual(["261089000"])
	})

	it("DICOM PS3.3 C.7.6.3.1.3 leaves Planar Configuration out of a grey image", () => {
		const colour = imageObject()
		const pixels = {
			...colour.stream.pixels,
			samplesPerPixel: 1,
			photometricInterpretation: "MONOCHROME2",
			planarConfiguration: undefined,
		}
		const { dataset } = imageFile({ ...colour, stream: { ...colour.stream, pixels } })

		expect(find(dataset, TAG.PLANAR_CONFIGURATION)).toBeUndefined()
		expectElements(dataset, [[0x00_28_00_04, "CS", "MONOCHROME2"]])
	})

	it.each<[string, readonly TransferSyntax[], RegExp]>([
		["Explicit VR Little Endian, which needs a decoder", [EXPLICIT], /not built in the transfer syntax/],
		["Implicit VR Little Endian, which needs a decoder", [IMPLICIT], /not built in the transfer syntax/],
		["no transfer syntax", [], /distinct transfer syntaxes/],
		["the same transfer syntax twice", [JPEG_BASELINE, JPEG_BASELINE], /distinct transfer syntaxes/],
	])("Q-043 does not build an image in %s (negative)", (_, transferSyntaxes, message) => {
		const object = imageObject()

		expect(() => imageArtifactOf(object, transferSyntaxes, IDENTITY)).toThrow(message)
	})
})

// integrace-dicom.md 3, 5.6, CAP-021-R10, CAP-021-R17
describe("P10 file of a scanned document", () => {
	it("CAP-021-R17 builds one variant for every configured transfer syntax with the same SOP Instance UID", () => {
		const variants = documentArtifactOf(documentObject(), [EXPLICIT, IMPLICIT], IDENTITY)
		const [explicit, implicit] = variants.map((variant) => readPart10(variant.part10))

		expect(variants.map((variant) => variant.transferSyntaxUid)).toEqual([EXPLICIT, IMPLICIT])
		expect(textOf(find(explicit?.meta ?? [], TAG.TRANSFER_SYNTAX_UID))).toBe(EXPLICIT)
		expect(textOf(find(implicit?.meta ?? [], TAG.TRANSFER_SYNTAX_UID))).toBe(IMPLICIT)
		expect(textOf(find(explicit?.dataset ?? [], TAG.SOP_INSTANCE_UID))).toBe("2.25.44")
		expect(textOf(find(implicit?.dataset ?? [], TAG.SOP_INSTANCE_UID))).toBe("2.25.44")
		expect(find(implicit?.dataset ?? [], TAG.SOP_INSTANCE_UID)?.vr).toBeUndefined()
		expect(variants[0]?.datasetSha256).not.toBe(variants[1]?.datasetSha256)
	})

	it("integrace-dicom.md 5.6 writes every attribute of the document with its VR and value", () => {
		const { dataset } = readPart10(only(documentArtifactOf(documentObject(), [EXPLICIT], IDENTITY)).part10)

		expectElements(dataset, [
			[0x00_08_00_16, "UI", "1.2.840.10008.5.1.4.1.1.104.1"],
			[0x00_08_00_60, "CS", "DOC"],
			[0x00_08_00_64, "CS", "SD"],
			[0x00_08_10_70, "PN", "Nováková^Jana"],
			[0x00_28_03_01, "CS", "YES"],
			[0x00_42_00_10, "ST", "Propouštěcí zpráva"],
			[0x00_42_00_12, "LO", "application/pdf"],
		])
		expect(required(find(dataset, TAG.CONCEPT_NAME_CODE_SEQUENCE)).items).toEqual([])
		expect(required(find(dataset, TAG.ENCAPSULATED_DOCUMENT)).vr).toBe("OB")
	})

	it("integrace-dicom.md 5.6 encapsulates the PDF unchanged and records its length before padding", () => {
		for (const variant of documentArtifactOf(documentObject(), [EXPLICIT, IMPLICIT], IDENTITY)) {
			const { dataset } = readPart10(variant.part10)
			const encapsulated = required(find(dataset, TAG.ENCAPSULATED_DOCUMENT)).value

			expect(ODD_PDF.length % 2).toBe(1)
			expect(encapsulated.subarray(0, ODD_PDF.length).equals(Buffer.from(ODD_PDF))).toBe(true)
			expect([...encapsulated.subarray(ODD_PDF.length)]).toEqual([PAD])
			expect(required(find(dataset, TAG.ENCAPSULATED_DOCUMENT_LENGTH)).value.readUInt32LE(0)).toBe(ODD_PDF.length)
		}
	})

	it("CAP-022-R06 encapsulates a PDF held in a view of a larger buffer and nothing around it", () => {
		const around = new Uint8Array(ODD_PDF.length + 16).fill(0x41)
		around.set(ODD_PDF, 8)
		const object = documentObject(around.subarray(8, 8 + ODD_PDF.length))
		const { dataset } = readPart10(only(documentArtifactOf(object, [EXPLICIT], IDENTITY)).part10)
		const encapsulated = required(find(dataset, TAG.ENCAPSULATED_DOCUMENT)).value

		expect(encapsulated).toHaveLength(ODD_PDF.length + 1)
		expect(encapsulated.subarray(0, ODD_PDF.length).equals(Buffer.from(ODD_PDF))).toBe(true)
	})
})

describe("reading the Patient ID back ✓ integrace-dicom.md 5.1, 9", () => {
	it("reads the Patient ID the builder wrote into every variant CAP-023-S20", () => {
		const variants = [
			...imageArtifactOf(imageObject(), [JPEG_BASELINE], IDENTITY),
			...documentArtifactOf(documentObject(), [EXPLICIT, IMPLICIT], IDENTITY),
		]
		for (const variant of variants) {
			expect(patientIdOf(variant.part10)).toBe("7001011234")
		}
	})
})

// Q-040, ADR-024, quality/data/synteticka-sada/README.md
const PHOTOS_FROM_THE_PHONE = [
	{
		name: "R01-overview.jpg",
		rows: 4080,
		columns: 3056,
		imageSha256: "5160d4298815caf612b318df9a594fe5fc75e0f44415b66ce569532e005833c6",
	},
	{
		name: "R02-overview.jpg",
		rows: 4080,
		columns: 3056,
		imageSha256: "e81d2392cb0ed99cf37359590f9b495fbb2a4f2604de3f2690c09c528b44521e",
	},
	{
		name: "R03-overview.jpg",
		rows: 3056,
		columns: 4080,
		imageSha256: "d17ccc4d49c7a7d41dca00963e712e0dfbf95bd9224eea75ded9285a9d418fc7",
	},
	{
		name: "R04-overview.jpg",
		rows: 4080,
		columns: 3056,
		imageSha256: "b3d4eaf38d990516ce43ad561a496fc4a46cdfb26728ec319cef9e00d46db2e1",
	},
	{
		name: "R05-overview.jpg",
		rows: 4080,
		columns: 3056,
		imageSha256: "2d7d1604d75bf021e903b514c9f5e5fbc262dd4fec2dbe3a9bdfa712cac00b45",
	},
] as const

function photoFromThePhone(name: string): Uint8Array {
	return new Uint8Array(readFileSync(resolve(PHONE_PHOTOS, name)))
}

function headerOf(jpeg: Uint8Array): { markers: number[]; scanStart: number } {
	const markers: number[] = []
	let offset = START_OF_IMAGE_BYTES
	while (jpeg[offset] === MARKER && jpeg[offset + 1] !== START_OF_SCAN) {
		markers.push(jpeg[offset + 1] as number)
		offset += MARKER_BYTES + (jpeg[offset + 2] as number) * LENGTH_HIGH_BYTE + (jpeg[offset + 3] as number)
	}
	return { markers, scanStart: offset }
}

function scanOf(jpeg: Uint8Array): Buffer {
	return Buffer.from(jpeg.subarray(headerOf(jpeg).scanStart))
}

describe("P10 file of a wound photo taken by the phone ✓ ADR-024, Q-040", () => {
	it.each(PHOTOS_FROM_THE_PHONE)(
		"CAP-021-S07 drops the Exif of $name and keeps its image data byte for byte",
		(photo) => {
			const received = photoFromThePhone(photo.name)
			const { bytes } = imageObject({ jpeg: received }).stream

			expect(headerOf(received).markers).toContain(EXIF)
			expect(headerOf(bytes).markers).not.toContain(EXIF)
			expect(scanOf(bytes).equals(scanOf(received))).toBe(true)
			expect(sha256(bytes)).toBe(photo.imageSha256)
		},
	)

	it.each(PHOTOS_FROM_THE_PHONE)("CAP-021-S02 builds a VL photographic P10 of $name in its real size", (photo) => {
		const object = imageObject({ jpeg: photoFromThePhone(photo.name) })
		const read = imageFile(object)
		const [, fragment] = required(find(read.dataset, TAG.PIXEL_DATA)).fragments ?? []

		expectElements(read.meta, [
			[TAG.MEDIA_STORAGE_SOP_CLASS_UID, "UI", "1.2.840.10008.5.1.4.1.1.77.1.4"],
			[TAG.TRANSFER_SYNTAX_UID, "UI", JPEG_BASELINE],
		])
		expect(required(find(read.dataset, TAG.ROWS)).value.readUInt16LE(0)).toBe(photo.rows)
		expect(required(find(read.dataset, TAG.COLUMNS)).value.readUInt16LE(0)).toBe(photo.columns)
		expect(fragment?.subarray(0, object.stream.bytes.length).equals(object.stream.bytes)).toBe(true)
	})
})
