import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type BodyView, LATERALITY, type Laterality, normalizedPointInRegion } from "@ansora/contracts"
import type { StoredArtifact } from "@ansora/vulna-adapter-dicom-dimse"
import {
	type BodySite,
	CURRENT_BODY_DIAGRAM,
	type DicomCommonSource,
	dicomDocumentObjectOf,
	dicomImageObjectOf,
	drawnBodySurfaceOf,
	type EditKind,
	uidOfUuid,
} from "@ansora/vulna-domain"
import { documentArtifactOf, imageArtifactOf, TRANSFER_SYNTAX } from "@ansora/vulna-projection-dicom"
import {
	ENCODER_IMPLEMENTATION_CLASS_UID,
	ENCODER_IMPLEMENTATION_VERSION_NAME,
	SYNTHETIC_PATIENT_ID,
} from "../synthetic"

// ADR-017, Q-028, Q-040, integrace-dicom.md 5, 11, 11.3

const WORKSPACE_FILE = "pnpm-workspace.yaml"
const SCAN_DIRECTORY = "quality/data/synteticka-sada/scan"
export const BLANK_PAGE = "page-blank.jpg"
export const TEXT_PAGE = "page-cs.jpg"
const PATIENT_ID_SYSTEM = "urn:oid:2.25.1"
const INSTANCE_LANGUAGE = "cs"
const BUILT_AT = new Date("2026-11-05T13:45:10Z")
const SOFTWARE_VERSION = "suite"
const UUID_PREFIX = "00000000-0000-4000-8000-"
const UUID_SUFFIX_DIGITS = 12
const HEXADECIMAL_RADIX = 16
const FINDING_ID = `${UUID_PREFIX}${"f".repeat(UUID_SUFFIX_DIGITS)}`
const IDENTITY = {
	implementationClassUid: ENCODER_IMPLEMENTATION_CLASS_UID,
	implementationVersionName: ENCODER_IMPLEMENTATION_VERSION_NAME,
}
const SYNTHETIC_PDF = new TextEncoder().encode(
	"%PDF-1.7\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
		"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
)
export const LONG_DESCRIPTION = "Spodina granuluje, okraje klidné, bez známek infekce. ".repeat(250)
export const TABBED_DESCRIPTION = "Rozměr:\t3 × 2 cm\nHloubka:\t0,5 cm"
// ITU-T T.81 B.1.1, CAP-021-S07
const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])
const APP1 = 0xe1
const COMMENT_MARKER = 0xfe
const LENGTH_BYTES = 2
const EXIF_WITHOUT_ENTRIES = Buffer.from("Exif\0\0II*\0\x08\0\0\0\0\0", "latin1")

export interface ImageChange {
	language?: string
	editKind?: EditKind
	description?: string
}

let uidCount = 0

function nextUid(): string {
	uidCount += 1
	return uidOfUuid(`${UUID_PREFIX}${uidCount.toString(HEXADECIMAL_RADIX).padStart(UUID_SUFFIX_DIGITS, "0")}`)
}

function commonSource(language: string): DicomCommonSource {
	return {
		assembly: { builtAt: BUILT_AT, language, softwareVersion: SOFTWARE_VERSION, patientIdSystem: PATIENT_ID_SYSTEM },
		patient: {
			familyName: "Syntetická",
			givenName: "Žofie",
			birthDate: "1970-01-01",
			sex: undefined,
			identifiers: [
				{ system: PATIENT_ID_SYSTEM, value: SYNTHETIC_PATIENT_ID, issuer: undefined, validUntil: undefined },
			],
		},
		encounter: {
			studyInstanceUid: nextUid(),
			studyId: "2026-000001",
			accessionNumber: undefined,
			date: "2026-11-05",
			startedAt: new Date("2026-11-05T09:12:00Z"),
		},
		series: { seriesInstanceUid: nextUid(), seriesNumber: 1 },
		operator: { familyName: "Svobodová", givenName: "Petra" },
		station: { hardwareId: "tHg7xQ2kP9aLmN3vR8sW1yZ4bC6dE0fG2hJ5kL7mN9p" },
		instance: { sopInstanceUid: nextUid(), instanceNumber: 1, acquiredAt: new Date("2026-11-05T09:15:30Z") },
	}
}

function repositoryRoot(): string {
	let directory = __dirname
	while (!existsSync(join(directory, WORKSPACE_FILE))) {
		const parent = dirname(directory)
		if (parent === directory) {
			throw new Error(`no ${WORKSPACE_FILE} above ${__dirname}`)
		}
		directory = parent
	}
	return directory
}

export function scanPage(name: string): Uint8Array {
	return new Uint8Array(readFileSync(join(repositoryRoot(), SCAN_DIRECTORY, name)))
}

function segmentOf(marker: number, payload: Buffer): Buffer {
	const header = Buffer.from([0xff, marker, 0, 0])
	header.writeUInt16BE(payload.length + LENGTH_BYTES, LENGTH_BYTES)
	return Buffer.concat([header, payload])
}

// CAP-021-S07
export function withMetadataAndTrailer(jpeg: Uint8Array): Uint8Array {
	const exif = segmentOf(APP1, EXIF_WITHOUT_ENTRIES)
	const comment = segmentOf(COMMENT_MARKER, Buffer.from("Pixel 9a, 49.19N 16.61E"))
	const gainMap = Buffer.concat([SOI, segmentOf(COMMENT_MARKER, Buffer.from("gain map")), EOI])
	return Buffer.concat([jpeg.subarray(0, SOI.length), exif, comment, jpeg.subarray(SOI.length), gainMap])
}

export interface SyntheticSite {
	name: string
	site: BodySite
}

// CAP-016-R04, CAP-016-R16, CAP-016-R20
export function sitesOfEveryRegion(): SyntheticSite[] {
	const sites = new Map<string, BodySite>()
	for (const [view, drawn] of Object.entries(CURRENT_BODY_DIAGRAM.views)) {
		for (const region of drawn === undefined ? [] : CURRENT_BODY_DIAGRAM.regions) {
			const sides: readonly (Laterality | null)[] = region.isPaired ? [LATERALITY.RIGHT, LATERALITY.LEFT] : [null]
			for (const laterality of sides) {
				const point = drawn && normalizedPointInRegion(view as BodyView, drawn, region.code, laterality)
				if (point === undefined) {
					continue
				}
				const site = { regionCode: region.code, laterality, view: view as BodyView, ...point }
				const drawnSite = { ...site, bodyDiagramVersion: CURRENT_BODY_DIAGRAM.version }
				const key = `${region.code}-${drawnBodySurfaceOf(drawnSite)}`
				sites.set(key, sites.get(key) ?? drawnSite)
			}
		}
	}
	return [...sites].map(([key, site]) => ({ name: `${key}-${site.laterality ?? "unpaired"}`, site }))
}

export function imageArtifact(site: BodySite, jpeg: Uint8Array, change: ImageChange = {}): StoredArtifact {
	const object = dicomImageObjectOf({
		...commonSource(change.language ?? INSTANCE_LANGUAGE),
		wound: { findingId: FINDING_ID, woundNumber: 2, bodySite: site },
		assessment: {
			woundTypeNames: { cs: "Dekubitus", en: "Pressure injury" },
			healingPhaseNames: { cs: "Granulační", en: "Granulation" },
			description: change.description ?? "Spodina granuluje, okraje klidné.",
		},
		editKind: change.editKind,
		jpeg,
	})
	return {
		sopClassUid: object.instance.sopClassUid,
		sopInstanceUid: object.instance.sopInstanceUid,
		variants: imageArtifactOf(object, [TRANSFER_SYNTAX.JPEG_BASELINE], IDENTITY),
	}
}

export function documentArtifact(): StoredArtifact {
	const object = dicomDocumentObjectOf({
		...commonSource(INSTANCE_LANGUAGE),
		title: { text: "Propouštěcí zpráva 1\\2026" },
		pdf: SYNTHETIC_PDF,
	})
	const transferSyntaxes = [TRANSFER_SYNTAX.EXPLICIT_VR_LITTLE_ENDIAN, TRANSFER_SYNTAX.IMPLICIT_VR_LITTLE_ENDIAN]
	return {
		sopClassUid: object.instance.sopClassUid,
		sopInstanceUid: object.instance.sopInstanceUid,
		variants: documentArtifactOf(object, transferSyntaxes, IDENTITY),
	}
}
