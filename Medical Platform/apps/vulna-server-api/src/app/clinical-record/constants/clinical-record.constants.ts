import { JOB_OBJECT_KIND } from "@ansora/core-server"
import type { HistoryRecords, HistoryWounds } from "@ansora/vulna-domain"
import type { WriteTaskObjectKind } from "../types/clinical-record.types"

export const WRITE_TASK_POLL_MILLISECONDS = 5000
// ADR-016 ř. 54
export const WRITE_TASK_LEASE_MILLISECONDS = 120_000

// datovy-model.md 13.2
export const LOCAL_KIND = {
	PATIENT: "patient",
	ENCOUNTER: "encounter",
	FINDING: "finding",
	FINDING_SITE: "finding-site",
	FINDING_WOUND_TYPE: "finding-wound-type",
	ASSESSMENT: "assessment",
	IMAGING_STUDY: "imaging-study",
	DOCUMENT: "document",
	DEVICE: "device",
	// CAP-021-R37
	IMAGE: "image",
	DOCUMENT_PAGE: "document-page",
	// ADR-053 bod 6
	ACTOR: "actor",
} as const

// datovy-model.md 4 „Artefakt“
export const ARTIFACT_SOURCE_KIND = {
	IMAGE: "image",
	DOCUMENT: "document",
} as const

// ADR-054 bod 2
export const NO_CLOSED_RECORDS: HistoryRecords = { findings: [], wounds: [], scans: [] }
export const NO_CLOSED_WOUNDS: HistoryWounds = { findings: [], wounds: [] }

export const FHIR_RESOURCE_TYPE = {
	PATIENT: "Patient",
	ENCOUNTER: "Encounter",
	CONDITION: "Condition",
	BODY_STRUCTURE: "BodyStructure",
	OBSERVATION: "Observation",
	IMAGING_STUDY: "ImagingStudy",
	DOCUMENT_REFERENCE: "DocumentReference",
	DEVICE: "Device",
	// ADR-053 bod 6
	PROJECT_MEMBERSHIP: "ProjectMembership",
} as const

// CAP-017-S15, CAP-021-R37, CAP-021-R39
export const READ_ONLY_SNAPSHOT = "isolation level repeatable read read only"

// CAP-021-R37, CAP-021-R39, stavy-a-mikrocopy.md E123
const FILE_RESOURCE_FAILURE_MESSAGE =
	"Úložiště klinického záznamu nepřijalo zdroj snímku nebo dokumentu. Po odstranění příčiny zápis zopakujte."

// CAP-021-R27, stavy-a-mikrocopy.md E123
export const WRITE_FAILURE_MESSAGE: Readonly<Record<WriteTaskObjectKind, string>> = {
	[JOB_OBJECT_KIND.ACTOR]:
		"Úložiště klinického záznamu nepřijalo zápis uživatele. Po odstranění příčiny zápis zopakujte.",
	[JOB_OBJECT_KIND.CODE_LIST_SET]:
		"Úložiště klinického záznamu nepřijalo publikaci číselníků. Po odstranění příčiny zápis zopakujte.",
	[JOB_OBJECT_KIND.IMAGE]: FILE_RESOURCE_FAILURE_MESSAGE,
	[JOB_OBJECT_KIND.DOCUMENT_PAGE]: FILE_RESOURCE_FAILURE_MESSAGE,
	[JOB_OBJECT_KIND.DOCUMENT]: FILE_RESOURCE_FAILURE_MESSAGE,
	// CAP-021-R28
	[JOB_OBJECT_KIND.ACQUISITION]:
		"Úložiště klinického záznamu nepřijalo instance studie a stopu doručení záznamu po uložení v PACS. Po odstranění příčiny zápis zopakujte.",
}
