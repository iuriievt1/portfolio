import {
	PATIENT_IDENTIFIER_VALUE_MAX_LENGTH,
	PATIENT_IDENTIFIER_VALUE_PATTERN,
	PATIENT_SEX,
	type PatientSex,
} from "@ansora/contracts"
import type { ClinicalPatient, CustomerIdentifier } from "../ports/clinical-record-store.port"
import { dicomDateOf } from "./date-time"
import { DICOM_MAPPING_FAILURE, DicomMappingError } from "./mapping-error"
import { personNameOf } from "./person-name"
import { EMPTY_VALUE, stringValueOf } from "./value-representation"

// integrace-dicom.md 5.1, DICOM PS3.3 C.7.1.1, integrace-dicom.md 5.9
const DICOM_SEX = {
	[PATIENT_SEX.MALE]: "M",
	[PATIENT_SEX.FEMALE]: "F",
	[PATIENT_SEX.OTHER]: "O",
} as const satisfies Record<PatientSex, string>

export type DicomSex = (typeof DICOM_SEX)[PatientSex] | typeof EMPTY_VALUE

export type DicomPatientSource = Pick<ClinicalPatient, "familyName" | "givenName" | "birthDate" | "sex" | "identifiers">

// integrace-dicom.md 5.1
export interface DicomPatient {
	patientName: string
	patientId: string
	issuerOfPatientId: string | undefined
	patientBirthDate: string
	patientSex: DicomSex
}

// integrace-dicom.md 5.1, NAB-373, CAP-013-R10
export function dicomPatientOf(patient: DicomPatientSource, patientIdSystem: string | undefined): DicomPatient {
	const identifier = patientIdentifierFor(patient.identifiers, patientIdSystem)
	return {
		patientName: personNameOf("Patient's Name", patient.familyName, patient.givenName),
		patientId: longStringOf("Patient ID", identifier.value),
		issuerOfPatientId:
			identifier.issuer === undefined ? undefined : longStringOf("Issuer of Patient ID", identifier.issuer),
		patientBirthDate:
			patient.birthDate === undefined ? EMPTY_VALUE : dicomDateOf("Patient's Birth Date", patient.birthDate),
		patientSex: patient.sex === undefined ? EMPTY_VALUE : DICOM_SEX[patient.sex],
	}
}

// integrace-dicom.md 4, 5.1, ADR-003 ř. 27, ADR-004 ř. 22
function patientIdentifierFor(
	identifiers: readonly CustomerIdentifier[],
	system: string | undefined,
): CustomerIdentifier {
	if (system === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.PATIENT_ID_SYSTEM_UNSET, "no identifier system is configured")
	}
	const current = identifiers.filter((candidate) => candidate.system === system && candidate.validUntil === undefined)
	const [identifier, ...others] = current
	if (identifier === undefined) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.PATIENT_ID_MISSING, `no current identifier in ${system}`)
	}
	if (others.length > 0) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.PATIENT_ID_AMBIGUOUS, `more current identifiers in ${system}`)
	}
	return identifier
}

// DICOM PS3.5 6.2 LO
function longStringOf(attribute: string, value: string): string {
	if (!PATIENT_IDENTIFIER_VALUE_PATTERN.test(value)) {
		throw new DicomMappingError(DICOM_MAPPING_FAILURE.INVALID_VALUE, `${attribute} is not a DICOM LO value`)
	}
	return stringValueOf(attribute, value, PATIENT_IDENTIFIER_VALUE_MAX_LENGTH)
}
