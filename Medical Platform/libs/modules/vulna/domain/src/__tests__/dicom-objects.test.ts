import { BODY_VIEW, LATERALITY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { type DicomDocumentSource, dicomDocumentObjectOf } from "../dicom/document-object"
import { type DicomImageSource, dicomImageObjectOf } from "../dicom/image-object"
import { DICOM_MAPPING_FAILURE } from "../dicom/mapping-error"
import { uidOfUuid } from "../dicom/uid"
import { EDIT_KIND, type EditKind } from "../entities/acquisition-file"
import { bodySiteAt } from "./body-site-at"
import { baselineJpegOf } from "./jpeg-bytes"

const BIRTH_NUMBER_SYSTEM = "https://ncez.mzcr.cz/fhir/sid/rcis"
const LOWER_CHEST_WALL = "699915001"
const FINDING_ID = "00000000-0000-4000-8000-000000000002"
const JPEG = baselineJpegOf()
const PDF = new TextEncoder().encode("%PDF-1.7\n%%EOF\n")
const SHORT_TEXT_MAX_LENGTH = 1024

const ASSEMBLY = {
	builtAt: new Date("2026-11-05T13:45:10Z"),
	language: "cs",
	softwareVersion: "1.0.0",
	patientIdSystem: BIRTH_NUMBER_SYSTEM,
}
const COMMON = {
	assembly: ASSEMBLY,
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

function imageSource(change: Partial<DicomImageSource> = {}): DicomImageSource {
	return {
		...COMMON,
		wound: {
			findingId: FINDING_ID,
			woundNumber: 2,
			bodySite: bodySiteAt(LOWER_CHEST_WALL, BODY_VIEW.ANTERIOR, LATERALITY.LEFT),
		},
		assessment: {
			woundTypeNames: { cs: "Dekubitus", en: "Pressure injury" },
			healingPhaseNames: { cs: "Granulační", en: "Granulation" },
			description: "Spodina granuluje.",
		},
		editKind: undefined,
		jpeg: JPEG,
		...change,
	}
}

function documentSource(change: Partial<DicomDocumentSource> = {}): DicomDocumentSource {
	return { ...COMMON, title: { names: { cs: "Propouštěcí zpráva", en: "Discharge report" } }, pdf: PDF, ...change }
}

// integrace-dicom.md 2, 5, CAP-021-R09, CAP-021-R15
describe("DICOM object of a wound image", () => {
	it("CAP-021-S02 is a VL Photographic Image of modality XC in the study and the series of the record", () => {
		const object = dicomImageObjectOf(imageSource())

		expect(object.instance.sopClassUid).toBe("1.2.840.10008.5.1.4.1.1.77.1.4")
		expect(object.series).toMatchObject({ modality: "XC", seriesInstanceUid: "2.25.22", seriesNumber: 1 })
		expect(object.study).toMatchObject({ studyInstanceUid: "2.25.11", accessionNumber: "" })
		expect(object.patient).toEqual({
			patientName: "",
			patientId: "7001011234",
			issuerOfPatientId: undefined,
			patientBirthDate: "",
			patientSex: "",
		})
		expect(object.stream.bytes).toEqual(JPEG)
	})

	it("CAP-021-S37 names the wound in Series Description, Tracking ID and Tracking UID and writes the place first in Image Comments", () => {
		const { wound } = dicomImageObjectOf(imageSource())

		expect(wound).toMatchObject({
			seriesDescription: "Rána 2 · Dolní část hrudní stěny (pod prsem) · levá strana",
			trackingId: "Rána 2",
			trackingUid: uidOfUuid(FINDING_ID),
			imageComments:
				"Rána 2 · Dolní část hrudní stěny (pod prsem) · levá strana pacienta · zepředu\r\n" +
				"Typ rány: Dekubitus\r\nFáze hojení: Granulační\r\nSpodina granuluje.",
			patientOrientation: "",
			burnedInAnnotation: "NO",
		})
	})

	it("CAP-021-S15 keeps every text Czech in a Czech instance although the names exist in English (negative)", () => {
		const { wound } = dicomImageObjectOf(imageSource())
		const texts = `${wound.seriesDescription}\n${wound.imageComments}\n${wound.trackingId}`

		for (const english of ["Wound", "Pressure injury", "Granulation", "Skin of", "side", "from the"]) {
			expect(texts).not.toContain(english)
		}
	})

	it("CAP-021-R26 writes the texts in the language of the instance and keeps the codes of the region", () => {
		const czech = dicomImageObjectOf(imageSource())
		const english = dicomImageObjectOf(imageSource({ assembly: { ...ASSEMBLY, language: "en" } }))

		expect(english.wound).toMatchObject({
			seriesDescription: "Wound 2 · Skin of lower chest wall · left side",
			imageComments:
				"Wound 2 · Skin of lower chest wall · patient's left side · from the front\r\n" +
				"Wound type: Pressure injury\r\nHealing phase: Granulation\r\nSpodina granuluje.",
		})
		expect(english.wound.anatomicRegion).toEqual(czech.wound.anatomicRegion)
		expect(english.wound.anatomicRegionModifiers).toEqual(czech.wound.anatomicRegionModifiers)
	})

	it.each<[EditKind, string, string]>([
		[
			EDIT_KIND.ROTATION,
			"Otočeno pořizovatelem před uzavřením záznamu",
			"Rotated by the operator before the record was closed",
		],
		[
			EDIT_KIND.CROP,
			"Oříznuto pořizovatelem před uzavřením záznamu",
			"Cropped by the operator before the record was closed",
		],
		[
			EDIT_KIND.ROTATION_AND_CROP,
			"Otočeno a oříznuto pořizovatelem před uzavřením záznamu",
			"Rotated and cropped by the operator before the record was closed",
		],
	])("CAP-021-S26 marks an image the operator changed by %s as DERIVED and says so", (editKind, czech, english) => {
		const inCzech = dicomImageObjectOf(imageSource({ editKind }))
		const inEnglish = dicomImageObjectOf(imageSource({ editKind, assembly: { ...ASSEMBLY, language: "en" } }))

		expect(inCzech.wound).toMatchObject({ imageType: ["DERIVED", "PRIMARY"], derivationDescription: czech })
		expect(inEnglish.wound.derivationDescription).toBe(english)
		expect(inCzech.stream.bytes).toEqual(JPEG)
	})

	it("CAP-021-S26 leaves an image as the camera took it ORIGINAL without a derivation", () => {
		expect(dicomImageObjectOf(imageSource()).wound).toMatchObject({
			imageType: ["ORIGINAL", "PRIMARY"],
			derivationDescription: undefined,
		})
	})

	it("CAP-014-S33 dates the study by the start of the visit, not by the image or the assembly, across midnight", () => {
		const object = dicomImageObjectOf(
			imageSource({
				encounter: { ...COMMON.encounter, date: "2026-07-14", startedAt: new Date("2026-07-14T20:40:00Z") },
				instance: { ...COMMON.instance, acquiredAt: new Date("2026-07-14T22:30:00Z") },
				assembly: { ...ASSEMBLY, builtAt: new Date("2026-07-15T06:00:00Z") },
			}),
		)

		expect(object.study).toMatchObject({ studyDate: "20260714", studyTime: "224000" })
		expect(object.instance).toMatchObject({
			contentDate: "20260715",
			contentTime: "003000",
			acquisitionDateTime: "20260715003000",
			instanceCreationDate: "20260715",
			instanceCreationTime: "080000",
		})
	})

	it.each([
		[
			"the identifier of the configured system",
			{ assembly: { ...ASSEMBLY, patientIdSystem: "urn:other" } },
			DICOM_MAPPING_FAILURE.PATIENT_ID_MISSING,
		],
		[
			"a wound number",
			{
				wound: {
					findingId: FINDING_ID,
					woundNumber: 0,
					bodySite: bodySiteAt(LOWER_CHEST_WALL, BODY_VIEW.ANTERIOR, LATERALITY.LEFT),
				},
			},
			DICOM_MAPPING_FAILURE.INVALID_VALUE,
		],
	])("CAP-013-R10, CAP-020-R23 builds no object without %s (negative)", (_, change, failure) => {
		expect(() => dicomImageObjectOf(imageSource(change))).toThrow(expect.objectContaining({ failure }))
	})
})

// integrace-dicom.md 2, 5.6, CAP-021-R10, CAP-022-R06
describe("DICOM object of a scanned document", () => {
	it("CAP-021-R10 is an Encapsulated PDF of modality DOC with the patient data burned in", () => {
		const object = dicomDocumentObjectOf(documentSource())

		expect(object.instance.sopClassUid).toBe("1.2.840.10008.5.1.4.1.1.104.1")
		expect(object.series.modality).toBe("DOC")
		expect(object.document).toEqual({
			documentTitle: "Propouštěcí zpráva",
			mimeType: "application/pdf",
			conversionType: "SD",
			burnedInAnnotation: "YES",
			bytes: PDF,
		})
	})

	it("CAP-021-R26 takes the title from the code list in the language of the instance", () => {
		const english = dicomDocumentObjectOf(documentSource({ assembly: { ...ASSEMBLY, language: "en" } }))

		expect(english.document.documentTitle).toBe("Discharge report")
	})

	it("CAP-018-R15 keeps a title the operator wrote, backslash and all, up to 1024 characters", () => {
		const text = `Report 1\\2026 ${"x".repeat(SHORT_TEXT_MAX_LENGTH - 14)}`

		expect(text).toHaveLength(SHORT_TEXT_MAX_LENGTH)
		expect(dicomDocumentObjectOf(documentSource({ title: { text } })).document.documentTitle).toBe(text)
	})

	it.each([
		[
			"bytes that are not a PDF",
			{ pdf: new TextEncoder().encode("<html>") },
			DICOM_MAPPING_FAILURE.UNSUPPORTED_DOCUMENT,
		],
		[
			"an executable named as a PDF",
			{ pdf: Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]) },
			DICOM_MAPPING_FAILURE.UNSUPPORTED_DOCUMENT,
		],
		["a title with a control character", { title: { text: "Zpráva\u0007" } }, DICOM_MAPPING_FAILURE.INVALID_VALUE],
		[
			"a title over 1024 characters",
			{ title: { text: "x".repeat(SHORT_TEXT_MAX_LENGTH + 1) } },
			DICOM_MAPPING_FAILURE.INVALID_VALUE,
		],
		[
			"a code list title missing in the language",
			{ title: { names: { en: "Discharge report" } } },
			DICOM_MAPPING_FAILURE.UNSUPPORTED_LANGUAGE,
		],
	])("integrace-dicom.md 5.6, kvalita-rizika-a-pouzitelnost.md 7.1 refuses %s (negative)", (_, change, failure) => {
		expect(() => dicomDocumentObjectOf(documentSource(change))).toThrow(expect.objectContaining({ failure }))
	})
})
