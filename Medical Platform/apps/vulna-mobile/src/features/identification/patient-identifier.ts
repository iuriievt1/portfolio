import {
	ERROR_CODE,
	PATIENT_IDENTIFIER_VALUE_MAX_LENGTH,
	PATIENT_IDENTIFIER_VALUE_PATTERN,
	PATIENT_TAG_SOURCE,
	type PatientIdentificationMethod,
} from "@ansora/contracts"
import { ApiProblemError } from "../../api/api-error"
import type { Patient } from "../../api/patients"
import { type RemoteFailure, remoteFailureOf } from "../../api/remote-failure"
import type { EffectiveConfiguration } from "../session/effective-configuration-store"

export type PatientCode = NonNullable<EffectiveConfiguration["patient_code"]>
export type PatientTag = NonNullable<EffectiveConfiguration["patient_tag"]>

export interface ReadIdentifier {
	system: string
	value: string
}

export interface ReadTag {
	uid: string | undefined
	ndefTexts: readonly string[]
}

export type IdentificationMethod = PatientIdentificationMethod

export const IDENTIFICATION = {
	OPEN: "open",
	CHOOSE: "choose",
	NOT_FOUND: "not_found",
} as const

export type Identification =
	| { kind: typeof IDENTIFICATION.OPEN; patient: Patient }
	| { kind: typeof IDENTIFICATION.CHOOSE; patients: Patient[] }
	| { kind: typeof IDENTIFICATION.NOT_FOUND }

export const IDENTIFICATION_NOTICE = {
	NOT_FOUND: "not_found",
	CODE_NOT_SET: "code_not_set",
	TAG_NOT_MAPPED: "tag_not_mapped",
	TAG_UNREADABLE: "tag_unreadable",
	NFC_DISABLED: "nfc_disabled",
	CAMERA_DENIED: "camera_denied",
	TOO_BROAD: "too_broad",
	RATE_LIMITED: "rate_limited",
	FAILED: "failed",
} as const

export type IdentificationNotice =
	| { kind: typeof IDENTIFICATION_NOTICE.NOT_FOUND }
	| { kind: typeof IDENTIFICATION_NOTICE.CODE_NOT_SET }
	| { kind: typeof IDENTIFICATION_NOTICE.TAG_NOT_MAPPED }
	| { kind: typeof IDENTIFICATION_NOTICE.TAG_UNREADABLE }
	| { kind: typeof IDENTIFICATION_NOTICE.NFC_DISABLED }
	| { kind: typeof IDENTIFICATION_NOTICE.CAMERA_DENIED }
	| { kind: typeof IDENTIFICATION_NOTICE.TOO_BROAD }
	| { kind: typeof IDENTIFICATION_NOTICE.RATE_LIMITED; retryAfterSeconds: number | undefined }
	| { kind: typeof IDENTIFICATION_NOTICE.FAILED; failure: RemoteFailure }

const FIRST_GROUP = 1

// CAP-013-R10, CAP-013-S21
function isPatientIdentifierValue(value: string): boolean {
	return value.length <= PATIENT_IDENTIFIER_VALUE_MAX_LENGTH && PATIENT_IDENTIFIER_VALUE_PATTERN.test(value)
}

function readIdentifierOf(system: string, value: string | undefined): ReadIdentifier | undefined {
	const trimmed = value?.trim() ?? ""
	return isPatientIdentifierValue(trimmed) ? { system, value: trimmed } : undefined
}

// CAP-013-R03
export function codeIdentifierOf(content: string, patientCode: PatientCode): ReadIdentifier | undefined {
	if (patientCode.pattern === undefined) {
		return readIdentifierOf(patientCode.system, content)
	}
	try {
		return readIdentifierOf(patientCode.system, new RegExp(patientCode.pattern).exec(content.trim())?.[FIRST_GROUP])
	} catch {
		return undefined
	}
}

// CAP-013-R05, CAP-013-S04
export function tagIdentifierOf(tag: ReadTag, patientTag: PatientTag): ReadIdentifier | undefined {
	if (patientTag.source === PATIENT_TAG_SOURCE.UID) {
		return readIdentifierOf(patientTag.system, tag.uid)
	}
	const [firstText] = tag.ndefTexts
	return readIdentifierOf(patientTag.system, firstText)
}

// CAP-013-R10
export function identificationOf(patients: readonly Patient[]): Identification {
	const [first] = patients
	if (first === undefined) {
		return { kind: IDENTIFICATION.NOT_FOUND }
	}
	return patients.length === 1
		? { kind: IDENTIFICATION.OPEN, patient: first }
		: { kind: IDENTIFICATION.CHOOSE, patients: [...patients] }
}

// CAP-013-R15, CAP-013-R17, CAP-013-S11, CAP-013-S12
export function noticeOfError(error: unknown): IdentificationNotice {
	if (error instanceof ApiProblemError && error.code === ERROR_CODE.SEARCH_RATE_LIMITED) {
		return { kind: IDENTIFICATION_NOTICE.RATE_LIMITED, retryAfterSeconds: error.retryAfterSeconds }
	}
	if (error instanceof ApiProblemError && error.code === ERROR_CODE.SEARCH_TOO_BROAD) {
		return { kind: IDENTIFICATION_NOTICE.TOO_BROAD }
	}
	return { kind: IDENTIFICATION_NOTICE.FAILED, failure: remoteFailureOf(error) }
}
