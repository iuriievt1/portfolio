import type { components } from "./generated/mobile"

type Schemas = components["schemas"]

export type EncounterStatus = Schemas["Encounter"]["status"]

// CAP-014-R18
export const ENCOUNTER_STATUS = {
	PLANNED: "planned",
	IN_PROGRESS: "in_progress",
	COMPLETED: "completed",
	CANCELLED: "cancelled",
} as const satisfies Record<string, EncounterStatus>

export type AcquisitionKind = Schemas["EncounterAcquisitionItem"]["kind"]

// CAP-015-R30
export const ACQUISITION_KIND = {
	PHOTO: "photo",
	SCAN: "scan",
} as const satisfies Record<string, AcquisitionKind>

export type AcquisitionStateValue = Schemas["AcquisitionStateValue"]

// CAP-019-R28
export const ACQUISITION_STATE_VALUE = {
	DRAFT: "draft",
	WAITING_FOR_FILES: "waiting_for_files",
	RECEIVED: "received",
	FAILED: "failed",
} as const satisfies Record<string, AcquisitionStateValue>

export type MissingStep = NonNullable<Schemas["MissingStep"]>

// CAP-014-R22, CAP-015-R31
export const MISSING_STEP = {
	IMAGES: "images",
	FINDING: "finding",
	BODY_SITE: "body_site",
	WOUND_TYPE: "wound_type",
	HEALING_PHASE: "healing_phase",
	PAGES: "pages",
	DOCUMENT_TITLE: "document_title",
	FILES: "files",
	SUMMARY: "summary",
} as const satisfies Record<string, MissingStep>

export type DiscardSituation = Schemas["AcquisitionDiscardRequest"]["situation"]

// clinical-workflow.yaml AcquisitionDiscardRequest, CAP-025-R20
export const DISCARD_SITUATION = {
	EXPLICIT_DISCARD: "explicit_discard",
	LOGOUT: "logout",
	NEXT_LOGIN: "next_login",
	DRAFT_LIMIT_REACHED: "draft_limit_reached",
	REMINDER: "reminder",
} as const satisfies Record<string, DiscardSituation>

export type PatientIdentificationMethod = Schemas["PatientIdentification"]["search_method"]

// CAP-013-R10, CAP-025-R18, CHG-175
export const PATIENT_IDENTIFICATION_METHOD = {
	CODE: "code",
	NFC_TAG: "nfc_tag",
} as const satisfies Record<string, PatientIdentificationMethod>

export type BodyView = Schemas["BodyView"]

// CAP-016-R04, clinical-workflow.yaml BodyView
export const BODY_VIEW = {
	ANTERIOR: "anterior",
	POSTERIOR: "posterior",
	RIGHT_LATERAL: "right_lateral",
	LEFT_LATERAL: "left_lateral",
	PLANTAR: "plantar",
	DORSAL: "dorsal",
} as const satisfies Record<string, BodyView>

export const BODY_VIEWS: readonly BodyView[] = [
	BODY_VIEW.RIGHT_LATERAL,
	BODY_VIEW.ANTERIOR,
	BODY_VIEW.PLANTAR,
	BODY_VIEW.DORSAL,
	BODY_VIEW.POSTERIOR,
	BODY_VIEW.LEFT_LATERAL,
]

export type Laterality = NonNullable<Schemas["BodySite"]["laterality"]>

// CAP-016-R16
export const LATERALITY = {
	RIGHT: "R",
	LEFT: "L",
} as const satisfies Record<string, Laterality>

export type PatientSex = NonNullable<Schemas["Patient"]["sex"]>

// CAP-013-R09
export const PATIENT_SEX = {
	MALE: "male",
	FEMALE: "female",
	OTHER: "other",
} as const satisfies Record<string, PatientSex>
