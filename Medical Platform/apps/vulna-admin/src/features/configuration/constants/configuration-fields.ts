import {
	CARD_IDENTITY_MODE,
	CONFIGURATION_KEY,
	type ConfigurationKey,
	PATIENT_TAG_SOURCE,
	PIN_COMPLEXITY,
	SYSLOG_FORMAT,
	SYSLOG_FRAMING,
	SYSLOG_TRANSPORT,
} from "@ansora/contracts"
import { DURATION_UNIT, type DurationUnit } from "@/lib/format"

export const FIELD_KIND = {
	SWITCH: "switch",
	COUNT: "count",
	DAYS: "days",
	MEGABYTES: "megabytes",
	DURATION: "duration",
	TEXT: "text",
	CHOICE: "choice",
	DEFAULT_LANGUAGE: "defaultLanguage",
	LANGUAGES: "languages",
	ROLE_MAPPING: "roleMapping",
	TRANSFER_SYNTAXES: "transferSyntaxes",
} as const

const CLOCK_UNITS: readonly DurationUnit[] = [DURATION_UNIT.MINUTE, DURATION_UNIT.HOUR, DURATION_UNIT.DAY]

export const TEXT_FORMAT = {
	IDENTIFIER: "identifier",
	APP_VERSION: "appVersion",
	HOST: "host",
	CAPTURING_PATTERN: "capturingPattern",
	URL: "url",
	SECURE_URL: "secureUrl",
	DICOM_UID: "dicomUid",
	AE_TITLE: "aeTitle",
} as const

export type TextFormat = (typeof TEXT_FORMAT)[keyof typeof TEXT_FORMAT]

interface ShownWhen {
	key: ConfigurationKey
	value: string
}

interface FieldBase {
	key: ConfigurationKey
	shownWhen?: ShownWhen
}

export type ConfigurationField = FieldBase &
	(
		| { kind: typeof FIELD_KIND.SWITCH }
		| { kind: typeof FIELD_KIND.COUNT; optional: boolean }
		| { kind: typeof FIELD_KIND.DAYS; optional: boolean }
		| { kind: typeof FIELD_KIND.MEGABYTES }
		| { kind: typeof FIELD_KIND.DURATION; units: readonly DurationUnit[]; optional: boolean }
		| { kind: typeof FIELD_KIND.TEXT; format: TextFormat; optional: boolean }
		| { kind: typeof FIELD_KIND.CHOICE; options: readonly string[]; optional: boolean }
		| { kind: typeof FIELD_KIND.DEFAULT_LANGUAGE }
		| { kind: typeof FIELD_KIND.LANGUAGES }
		| { kind: typeof FIELD_KIND.ROLE_MAPPING }
		| { kind: typeof FIELD_KIND.TRANSFER_SYNTAXES }
	)

// DESIGN.md 9.1
export const CONFIGURATION_TAB = {
	LOGIN: "login",
	RECORDS: "records",
	APP: "app",
	PATIENTS: "patients",
	DATA: "data",
	INTEGRATIONS: "integrations",
} as const

export type ConfigurationTabId = (typeof CONFIGURATION_TAB)[keyof typeof CONFIGURATION_TAB]

export const CONFIGURATION_TABS: readonly ConfigurationTabId[] = Object.values(CONFIGURATION_TAB)

export const CONFIGURATION_SECTION = {
	LOGIN_METHODS: "loginMethods",
	PIN: "pin",
	CARD_AND_QR: "cardAndQr",
	MOBILE_SESSION: "mobileSession",
	ADMINISTRATION_SESSION: "administrationSession",
	ACCESS: "access",
	ACCOUNT_ATTRIBUTES: "accountAttributes",
	WOUND_RECORD: "woundRecord",
	DOCUMENTS: "documents",
	DRAFTS: "drafts",
	UPLOAD: "upload",
	VIEWING_COPY: "viewingCopy",
	PHONE: "phone",
	HOME_SCREEN: "homeScreen",
	LANGUAGES: "languages",
	WRISTBAND_CODE: "wristbandCode",
	WRISTBAND_NFC: "wristbandNfc",
	IDENTIFICATION_LIMITS: "identificationLimits",
	REGISTRY: "registry",
	RETENTION: "retention",
	ORPHANS: "orphans",
	PACS: "pacs",
	SYSLOG: "syslog",
	CLINICAL_RECORD: "clinicalRecord",
} as const

type ConfigurationSectionId = (typeof CONFIGURATION_SECTION)[keyof typeof CONFIGURATION_SECTION]

export interface ConfigurationSection {
	id: ConfigurationSectionId
	tab: ConfigurationTabId
	fields: readonly ConfigurationField[]
}

const switchField = (key: ConfigurationKey): ConfigurationField => ({ kind: FIELD_KIND.SWITCH, key })
const count = (key: ConfigurationKey): ConfigurationField => ({ kind: FIELD_KIND.COUNT, key, optional: false })
const optionalCount = (key: ConfigurationKey): ConfigurationField => ({ kind: FIELD_KIND.COUNT, key, optional: true })
const aeTitle = (key: ConfigurationKey): ConfigurationField => ({
	kind: FIELD_KIND.TEXT,
	key,
	format: TEXT_FORMAT.AE_TITLE,
	optional: true,
})
const transferSyntaxes = (key: ConfigurationKey): ConfigurationField => ({ kind: FIELD_KIND.TRANSFER_SYNTAXES, key })
const days = (key: ConfigurationKey): ConfigurationField => ({ kind: FIELD_KIND.DAYS, key, optional: false })
// CAP-026-R02, CAP-026-R20
const optionalDays = (key: ConfigurationKey): ConfigurationField => ({ kind: FIELD_KIND.DAYS, key, optional: true })
const duration = (key: ConfigurationKey, units: readonly DurationUnit[] = CLOCK_UNITS): ConfigurationField => ({
	kind: FIELD_KIND.DURATION,
	key,
	units,
	optional: false,
})
const identifier = (key: ConfigurationKey, shownWhen?: ShownWhen): ConfigurationField => ({
	kind: FIELD_KIND.TEXT,
	key,
	format: TEXT_FORMAT.IDENTIFIER,
	optional: true,
	shownWhen,
})

const CARD_APPLICATION_MODE: ShownWhen = {
	key: CONFIGURATION_KEY.CARD_IDENTITY_MODE,
	value: CARD_IDENTITY_MODE.CARD_APPLICATION_IDENTIFIER,
}

// konfigurace-a-profily.md 2.1–2.4, 2.8, 2.9, administration.yaml getConfiguration
export const CONFIGURATION_SECTIONS: readonly ConfigurationSection[] = [
	{
		id: CONFIGURATION_SECTION.LOGIN_METHODS,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			switchField(CONFIGURATION_KEY.LOGIN_METHOD_CARD),
			switchField(CONFIGURATION_KEY.LOGIN_METHOD_QR),
			switchField(CONFIGURATION_KEY.LOGIN_METHOD_BARCODE),
			switchField(CONFIGURATION_KEY.LOGIN_METHOD_PIN),
		],
	},
	{
		id: CONFIGURATION_SECTION.PIN,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			count(CONFIGURATION_KEY.PIN_MIN_LENGTH),
			{
				kind: FIELD_KIND.CHOICE,
				key: CONFIGURATION_KEY.PIN_COMPLEXITY,
				options: [PIN_COMPLEXITY.STANDARD, PIN_COMPLEXITY.NONE],
				optional: false,
			},
			count(CONFIGURATION_KEY.PIN_ATTEMPTS_LIMIT),
			duration(CONFIGURATION_KEY.PIN_DELAY_SECONDS, [DURATION_UNIT.SECOND]),
		],
	},
	{
		id: CONFIGURATION_SECTION.CARD_AND_QR,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			count(CONFIGURATION_KEY.CREDENTIAL_ATTEMPTS_LIMIT),
			{
				kind: FIELD_KIND.CHOICE,
				key: CONFIGURATION_KEY.CARD_IDENTITY_MODE,
				options: [
					CARD_IDENTITY_MODE.UID_BINDING,
					CARD_IDENTITY_MODE.CARD_APPLICATION_IDENTIFIER,
					CARD_IDENTITY_MODE.CUSTOMER_CARD_SYSTEM,
				],
				optional: false,
			},
			identifier(CONFIGURATION_KEY.CARD_IDENTIFIER, CARD_APPLICATION_MODE),
			identifier(CONFIGURATION_KEY.CARD_ACCOUNT_CLAIM, CARD_APPLICATION_MODE),
			duration(CONFIGURATION_KEY.CARD_BINDING_CODE_LIFETIME_SECONDS),
		],
	},
	{
		id: CONFIGURATION_SECTION.MOBILE_SESSION,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			duration(CONFIGURATION_KEY.SESSION_MAX_SECONDS),
			duration(CONFIGURATION_KEY.IDLE_LOCK_SECONDS),
			duration(CONFIGURATION_KEY.TOKEN_VALIDITY_SECONDS),
			duration(CONFIGURATION_KEY.FULL_LOGIN_INTERVAL_SECONDS),
		],
	},
	{
		id: CONFIGURATION_SECTION.ADMINISTRATION_SESSION,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			duration(CONFIGURATION_KEY.ADMINISTRATION_IDLE_LOGOUT_SECONDS),
			duration(CONFIGURATION_KEY.ADMINISTRATION_SESSION_MAX_SECONDS),
		],
	},
	{
		id: CONFIGURATION_SECTION.ACCESS,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			identifier(CONFIGURATION_KEY.AUTHORIZED_GROUP),
			{ kind: FIELD_KIND.ROLE_MAPPING, key: CONFIGURATION_KEY.GROUP_TO_ROLE },
		],
	},
	{
		id: CONFIGURATION_SECTION.ACCOUNT_ATTRIBUTES,
		tab: CONFIGURATION_TAB.LOGIN,
		fields: [
			identifier(CONFIGURATION_KEY.PERSONAL_NUMBER_CLAIM),
			identifier(CONFIGURATION_KEY.LOGIN_NAME_CLAIM),
			identifier(CONFIGURATION_KEY.EMAIL_CLAIM),
			identifier(CONFIGURATION_KEY.GROUP_CLAIM),
			identifier(CONFIGURATION_KEY.DEPARTMENT_CLAIM),
		],
	},
	{
		id: CONFIGURATION_SECTION.WOUND_RECORD,
		tab: CONFIGURATION_TAB.RECORDS,
		fields: [
			count(CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES),
			switchField(CONFIGURATION_KEY.ACQUISITION_WOUND_TYPE_ENABLED),
			switchField(CONFIGURATION_KEY.ACQUISITION_HEALING_PHASE_ENABLED),
		],
	},
	{
		id: CONFIGURATION_SECTION.DOCUMENTS,
		tab: CONFIGURATION_TAB.RECORDS,
		fields: [count(CONFIGURATION_KEY.DOCUMENT_MAX_PAGES)],
	},
	{
		id: CONFIGURATION_SECTION.DRAFTS,
		tab: CONFIGURATION_TAB.RECORDS,
		fields: [
			count(CONFIGURATION_KEY.MAX_DRAFT_ACQUISITIONS),
			duration(CONFIGURATION_KEY.DRAFT_ACQUISITION_REMINDER_SECONDS),
			duration(CONFIGURATION_KEY.DRAFT_DISCARD_CONSENT_ABSENCE_SECONDS),
		],
	},
	{
		id: CONFIGURATION_SECTION.UPLOAD,
		tab: CONFIGURATION_TAB.RECORDS,
		fields: [duration(CONFIGURATION_KEY.ACQUISITION_UPLOAD_PERMISSION_LIFETIME_SECONDS)],
	},
	{
		id: CONFIGURATION_SECTION.VIEWING_COPY,
		tab: CONFIGURATION_TAB.RECORDS,
		fields: [count(CONFIGURATION_KEY.VIEWING_COPY_MAX_LONG_EDGE_PX), count(CONFIGURATION_KEY.VIEWING_COPY_QUALITY)],
	},
	{
		id: CONFIGURATION_SECTION.PHONE,
		tab: CONFIGURATION_TAB.APP,
		fields: [
			{
				kind: FIELD_KIND.TEXT,
				key: CONFIGURATION_KEY.MINIMUM_APP_VERSION,
				format: TEXT_FORMAT.APP_VERSION,
				optional: true,
			},
			{ kind: FIELD_KIND.MEGABYTES, key: CONFIGURATION_KEY.LOW_STORAGE_WARNING_BYTES },
			count(CONFIGURATION_KEY.QUEUE_MAX_ITEMS),
			duration(CONFIGURATION_KEY.DEVICE_KEY_HOLD_SECONDS),
		],
	},
	{
		id: CONFIGURATION_SECTION.HOME_SCREEN,
		tab: CONFIGURATION_TAB.APP,
		fields: [
			count(CONFIGURATION_KEY.HOME_DRAFT_ACQUISITIONS_MAX_ROWS),
			switchField(CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_ENABLED),
			{
				...count(CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_MAX_ITEMS),
				shownWhen: { key: CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_ENABLED, value: String(true) },
			},
			{
				...count(CONFIGURATION_KEY.RECENT_PATIENTS_MAX_ITEMS),
				shownWhen: { key: CONFIGURATION_KEY.SCHEDULED_ENCOUNTERS_ENABLED, value: String(false) },
			},
		],
	},
	{
		id: CONFIGURATION_SECTION.LANGUAGES,
		tab: CONFIGURATION_TAB.APP,
		fields: [
			{ kind: FIELD_KIND.LANGUAGES, key: CONFIGURATION_KEY.SUPPORTED_LANGUAGES },
			{ kind: FIELD_KIND.DEFAULT_LANGUAGE, key: CONFIGURATION_KEY.DEFAULT_LANGUAGE },
		],
	},
	{
		id: CONFIGURATION_SECTION.WRISTBAND_CODE,
		tab: CONFIGURATION_TAB.PATIENTS,
		fields: [
			identifier(CONFIGURATION_KEY.PATIENT_CODE_SYSTEM),
			{
				kind: FIELD_KIND.TEXT,
				key: CONFIGURATION_KEY.PATIENT_CODE_PATTERN,
				format: TEXT_FORMAT.CAPTURING_PATTERN,
				optional: true,
			},
		],
	},
	{
		id: CONFIGURATION_SECTION.WRISTBAND_NFC,
		tab: CONFIGURATION_TAB.PATIENTS,
		fields: [
			{
				kind: FIELD_KIND.CHOICE,
				key: CONFIGURATION_KEY.PATIENT_TAG_SOURCE,
				options: [PATIENT_TAG_SOURCE.NDEF_TEXT, PATIENT_TAG_SOURCE.UID],
				optional: true,
			},
			identifier(CONFIGURATION_KEY.PATIENT_TAG_SYSTEM),
		],
	},
	{
		id: CONFIGURATION_SECTION.IDENTIFICATION_LIMITS,
		tab: CONFIGURATION_TAB.PATIENTS,
		fields: [count(CONFIGURATION_KEY.PATIENT_SEARCH_PER_USER), count(CONFIGURATION_KEY.PATIENT_SEARCH_PER_DEVICE)],
	},
	{
		id: CONFIGURATION_SECTION.REGISTRY,
		tab: CONFIGURATION_TAB.PATIENTS,
		fields: [
			days(CONFIGURATION_KEY.REGISTRY_WINDOW_DAYS_BACK),
			days(CONFIGURATION_KEY.REGISTRY_WINDOW_DAYS_AHEAD),
			{
				kind: FIELD_KIND.DURATION,
				key: CONFIGURATION_KEY.REGISTRY_SYNC_PERIOD_SECONDS,
				units: CLOCK_UNITS,
				optional: true,
			},
		],
	},
	{
		id: CONFIGURATION_SECTION.RETENTION,
		tab: CONFIGURATION_TAB.DATA,
		fields: [
			days(CONFIGURATION_KEY.RETENTION_FULL_IMAGES_DAYS),
			optionalDays(CONFIGURATION_KEY.RETENTION_THUMBNAILS_DAYS),
			optionalDays(CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS),
			duration(CONFIGURATION_KEY.RETENTION_DEVICE_LOCAL_COPY_SECONDS),
			days(CONFIGURATION_KEY.RETENTION_AUDIT_DAYS),
		],
	},
	{
		id: CONFIGURATION_SECTION.ORPHANS,
		tab: CONFIGURATION_TAB.DATA,
		fields: [duration(CONFIGURATION_KEY.ORPHAN_SET_ASIDE_AFTER_SECONDS)],
	},
	// CAP-012-R01, CAP-012-S01, CAP-021-R17, konfigurace-a-profily.md 2.1, integrace-dicom.md 3
	{
		id: CONFIGURATION_SECTION.PACS,
		tab: CONFIGURATION_TAB.INTEGRATIONS,
		fields: [
			{ kind: FIELD_KIND.TEXT, key: CONFIGURATION_KEY.PACS_HOST, format: TEXT_FORMAT.HOST, optional: true },
			optionalCount(CONFIGURATION_KEY.PACS_PORT),
			aeTitle(CONFIGURATION_KEY.PACS_AE_TITLE),
			aeTitle(CONFIGURATION_KEY.PACS_CALLING_AE_TITLE),
			{
				kind: FIELD_KIND.TEXT,
				key: CONFIGURATION_KEY.DICOM_IMPLEMENTATION_CLASS_UID,
				format: TEXT_FORMAT.DICOM_UID,
				optional: true,
			},
			transferSyntaxes(CONFIGURATION_KEY.DICOM_IMAGE_TRANSFER_SYNTAXES),
			transferSyntaxes(CONFIGURATION_KEY.DICOM_DOCUMENT_TRANSFER_SYNTAXES),
			count(CONFIGURATION_KEY.VERIFICATION_REJECTIONS_BEFORE_ALERT),
			duration(CONFIGURATION_KEY.TARGET_UNAVAILABLE_ALERT_SECONDS),
		],
	},
	{
		id: CONFIGURATION_SECTION.SYSLOG,
		tab: CONFIGURATION_TAB.INTEGRATIONS,
		fields: [
			{ kind: FIELD_KIND.TEXT, key: CONFIGURATION_KEY.SYSLOG_HOST, format: TEXT_FORMAT.HOST, optional: true },
			count(CONFIGURATION_KEY.SYSLOG_PORT),
			{
				kind: FIELD_KIND.CHOICE,
				key: CONFIGURATION_KEY.SYSLOG_TRANSPORT,
				options: [SYSLOG_TRANSPORT.TLS, SYSLOG_TRANSPORT.TCP, SYSLOG_TRANSPORT.UDP],
				optional: false,
			},
			{
				kind: FIELD_KIND.CHOICE,
				key: CONFIGURATION_KEY.SYSLOG_FRAMING,
				options: [SYSLOG_FRAMING.OCTET_COUNTING, SYSLOG_FRAMING.NON_TRANSPARENT],
				optional: false,
				shownWhen: { key: CONFIGURATION_KEY.SYSLOG_TRANSPORT, value: SYSLOG_TRANSPORT.TCP },
			},
			{
				kind: FIELD_KIND.CHOICE,
				key: CONFIGURATION_KEY.SYSLOG_FORMAT,
				options: [SYSLOG_FORMAT.RFC5424, SYSLOG_FORMAT.RFC3164],
				optional: false,
			},
			count(CONFIGURATION_KEY.SYSLOG_ENTERPRISE_NUMBER),
		],
	},
	// CAP-012-R30, konfigurace-a-profily.md 2.1
	{
		id: CONFIGURATION_SECTION.CLINICAL_RECORD,
		tab: CONFIGURATION_TAB.INTEGRATIONS,
		fields: [
			{
				kind: FIELD_KIND.TEXT,
				key: CONFIGURATION_KEY.CLINICAL_RECORD_BASE_URL,
				format: TEXT_FORMAT.URL,
				optional: false,
			},
			{
				kind: FIELD_KIND.TEXT,
				key: CONFIGURATION_KEY.CLINICAL_RECORD_INSTANCE_BASE_URI,
				format: TEXT_FORMAT.URL,
				optional: false,
			},
			// ADR-053 (doplnění 2026-09-24) bod 1, CAP-011-R02
			{
				kind: FIELD_KIND.TEXT,
				key: CONFIGURATION_KEY.CLINICAL_RECORD_STORAGE_URL,
				format: TEXT_FORMAT.SECURE_URL,
				optional: false,
			},
		],
	},
]
