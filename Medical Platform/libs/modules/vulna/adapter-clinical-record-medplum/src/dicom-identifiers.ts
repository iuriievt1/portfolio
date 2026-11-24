import type { Coding, Identifier } from "./fhir-types"

// datovy-model.md 13.3
export const DICOM_ONTOLOGY = "http://dicom.nema.org/resources/ontology/DCM"
const STUDY_INSTANCE_UID_TYPE = "110180"
const SERIES_INSTANCE_UID_TYPE = "112002"
const DICOM_UID_SYSTEM = "urn:dicom:uid"
const OID_PREFIX = "urn:oid:"
// integrace-dicom.md 5.9 SOP Class UID, SOP Instance UID
const URI_SYSTEM = "urn:ietf:rfc:3986"

// integrace-dicom.md 5.9
export const MODALITY = {
	PHOTO: "XC",
	DOCUMENT: "DOC",
} as const

export type Modality = (typeof MODALITY)[keyof typeof MODALITY]

function dicomUidIdentifierOf(type: string, uid: string): Identifier {
	return {
		type: { coding: [{ system: DICOM_ONTOLOGY, code: type }] },
		system: DICOM_UID_SYSTEM,
		value: `${OID_PREFIX}${uid}`,
	}
}

// datovy-model.md 13.3, integrace-dicom.md 5.9
export function studyInstanceUidIdentifierOf(uid: string): Identifier {
	return dicomUidIdentifierOf(STUDY_INSTANCE_UID_TYPE, uid)
}

// datovy-model.md 13.3, integrace-dicom.md 5.9
export function seriesInstanceUidIdentifierOf(uid: string): Identifier {
	return dicomUidIdentifierOf(SERIES_INSTANCE_UID_TYPE, uid)
}

// integrace-dicom.md 5.9, CAP-021-R28
export function sopInstanceUidIdentifierOf(uid: string): Identifier {
	return { system: URI_SYSTEM, value: `${OID_PREFIX}${uid}` }
}

// integrace-dicom.md 5.9
export function sopClassOf(uid: string): Coding {
	return { system: URI_SYSTEM, code: `${OID_PREFIX}${uid}` }
}

// integrace-dicom.md 5.9
export function modalityOf(modality: Modality): Coding {
	return { system: DICOM_ONTOLOGY, code: modality }
}

// datovy-model.md 13.3, integrace-dicom.md 5.9
export function studyInstanceUidOf(identifiers: readonly Identifier[] | undefined): string | undefined {
	const identifier = identifiers?.find(
		(candidate) =>
			candidate.system === DICOM_UID_SYSTEM &&
			candidate.type?.coding?.some(
				(coding) => coding.system === DICOM_ONTOLOGY && coding.code === STUDY_INSTANCE_UID_TYPE,
			),
	)
	const value = identifier?.value
	return value?.startsWith(OID_PREFIX) === true ? value.slice(OID_PREFIX.length) : undefined
}
