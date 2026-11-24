import { ADMIN_API_BASE_PATH } from "@ansora/contracts"

// CAP-013-R17
export const PATIENT_SEARCH_MAX_MATCHES = 20
export const PATIENT_SEARCH_READ_LIMIT = PATIENT_SEARCH_MAX_MATCHES + 1
export const PATIENT_IDENTIFIER_SYSTEM_MAX_LENGTH = 255

export const PATIENT_SEARCH_RATE_KEY = {
	USER: "patient-search:user",
	DEVICE: "patient-search:device",
} as const

export const PATIENTS_PATH = "patients"
// clinical-workflow.yaml identifyPatient
export const IDENTIFICATION_SUBPATH = "identification"
export const SYNC_STATE_PATH = `${ADMIN_API_BASE_PATH}/monitoring/sync`
