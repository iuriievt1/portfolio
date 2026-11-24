import type { components } from "./generated/administration"
import type { components as mobileComponents } from "./generated/mobile"

// konfigurace-a-profily.md 2, administration.yaml getConfiguration
export const CONFIGURATION_KEY = {
	DEFAULT_LANGUAGE: "localization.default_language",
	SUPPORTED_LANGUAGES: "localization.supported_languages",
	LOGIN_METHOD_CARD: "login_methods.card",
	LOGIN_METHOD_QR: "login_methods.qr",
	LOGIN_METHOD_BARCODE: "login_methods.barcode",
	LOGIN_METHOD_PIN: "login_methods.pin",
	SESSION_MAX_SECONDS: "session_policy.session_max_seconds",
	TOKEN_VALIDITY_SECONDS: "session_policy.token_validity_seconds",
	IDLE_LOCK_SECONDS: "session_policy.idle_lock_seconds",
	FULL_LOGIN_INTERVAL_SECONDS: "session_policy.full_login_interval_seconds",
	PIN_MIN_LENGTH: "pin_policy.min_length",
	PIN_COMPLEXITY: "pin_policy.complexity",
	PIN_ATTEMPTS_LIMIT: "pin_policy.attempts_limit",
	PIN_DELAY_SECONDS: "pin_policy.delay_seconds",
	CREDENTIAL_ATTEMPTS_LIMIT: "login_policy.credential_attempts_limit",
	CARD_IDENTITY_MODE: "card_identity.mode",
	CARD_IDENTIFIER: "card_identity.card_identifier",
	CARD_ACCOUNT_CLAIM: "card_identity.account_claim",
	CARD_BINDING_CODE_LIFETIME_SECONDS: "card_binding.code_lifetime_seconds",
	PERSONAL_NUMBER_CLAIM: "identity_provider.personal_number_claim",
	LOGIN_NAME_CLAIM: "identity_provider.login_name_claim",
	EMAIL_CLAIM: "identity_provider.email_claim",
	GROUP_CLAIM: "identity_provider.group_claim",
	AUTHORIZED_GROUP: "identity_provider.authorized_group",
	DEPARTMENT_CLAIM: "identity_provider.department_claim",
	GROUP_TO_ROLE: "role_mapping.group_to_role",
	ADMINISTRATION_IDLE_LOGOUT_SECONDS: "administration.idle_logout_seconds",
	ADMINISTRATION_SESSION_MAX_SECONDS: "administration.session_max_seconds",
	MINIMUM_APP_VERSION: "mobile_app.minimum_version",
	DEVICE_TOKEN_LIFETIME_SECONDS: "device_token.lifetime_seconds",
	QUEUE_MAX_ITEMS: "mobile_app.queue_max_items",
	LOW_STORAGE_WARNING_BYTES: "mobile_app.low_storage_warning_bytes",
	MAX_DRAFT_ACQUISITIONS: "mobile_app.max_draft_acquisitions",
	DRAFT_ACQUISITION_REMINDER_SECONDS: "mobile_app.draft_acquisition_reminder_seconds",
	DRAFT_DISCARD_CONSENT_ABSENCE_SECONDS: "mobile_app.draft_discard_consent_absence_seconds",
	DEVICE_KEY_HOLD_SECONDS: "mobile_app.device_key_hold_seconds",
	SCHEDULED_ENCOUNTERS_ENABLED: "mobile_app.scheduled_encounters_enabled",
	SCHEDULED_ENCOUNTERS_MAX_ITEMS: "mobile_app.scheduled_encounters_max_items",
	RECENT_PATIENTS_MAX_ITEMS: "mobile_app.recent_patients_max_items",
	HOME_DRAFT_ACQUISITIONS_MAX_ROWS: "mobile_app.home_draft_acquisitions_max_rows",
	PATIENT_SEARCH_PER_USER: "patient_search.max_queries_per_minute_per_user",
	PATIENT_SEARCH_PER_DEVICE: "patient_search.max_queries_per_minute_per_device",
	PATIENT_CODE_SYSTEM: "patient_identification.code_system",
	PATIENT_CODE_PATTERN: "patient_identification.code_pattern",
	PATIENT_TAG_SOURCE: "patient_identification.nfc_source",
	PATIENT_TAG_SYSTEM: "patient_identification.nfc_system",
	REGISTRY_WINDOW_DAYS_BACK: "registry_sync.window_days_back",
	REGISTRY_WINDOW_DAYS_AHEAD: "registry_sync.window_days_ahead",
	REGISTRY_SYNC_PERIOD_SECONDS: "registry_sync.period_seconds",
	RETENTION_FULL_IMAGES_DAYS: "retention.full_images_days",
	RETENTION_THUMBNAILS_DAYS: "retention.thumbnails_days",
	RETENTION_DEVICE_LOCAL_COPY_SECONDS: "retention.device_local_copy_seconds",
	RETENTION_AUDIT_DAYS: "retention.audit_days",
	VERIFICATION_REJECTIONS_BEFORE_ALERT: "delivery.verification_rejections_before_alert",
	TARGET_UNAVAILABLE_ALERT_SECONDS: "delivery.target_unavailable_alert_seconds",
	// CAP-023-R10, dorucovaci-jadro.md 5, konfigurace-a-profily.md 2.7
	DELIVERY_MAX_ATTEMPTS: "delivery.max_attempts",
	DELIVERY_RETRY_BACKOFF_MIN_SECONDS: "delivery.retry_backoff_min_seconds",
	DELIVERY_RETRY_BACKOFF_MAX_SECONDS: "delivery.retry_backoff_max_seconds",
	// CAP-023-R13, CAP-023-R26, dorucovaci-jadro.md 5.1
	DELIVERY_VERIFICATION_DELAY_SECONDS: "delivery.verification_delay_seconds",
	ORPHAN_SET_ASIDE_AFTER_SECONDS: "binary_store.orphan_set_aside_after_seconds",
	ACQUISITION_MAX_IMAGES: "acquisition.max_images",
	ACQUISITION_MAX_BYTES: "acquisition.max_bytes",
	// CAP-017-R16, CHG-181
	ACQUISITION_WOUND_TYPE_ENABLED: "acquisition.wound_type_enabled",
	ACQUISITION_HEALING_PHASE_ENABLED: "acquisition.healing_phase_enabled",
	// ADR-014
	ACQUISITION_UPLOAD_PERMISSION_LIFETIME_SECONDS: "acquisition.upload_permission_lifetime_seconds",
	DOCUMENT_MAX_PAGES: "document.max_pages",
	// CAP-021-R40, konfigurace-a-profily.md 2.1
	VIEWING_COPY_MAX_LONG_EDGE_PX: "viewing_copy.max_long_edge_px",
	VIEWING_COPY_FORMAT: "viewing_copy.format",
	VIEWING_COPY_QUALITY: "viewing_copy.quality",
	// CAP-026-R20, konfigurace-a-profily.md 2.4
	VIEWING_COPY_RETENTION_DAYS: "viewing_copy.retention_days",
	// ADR-016 ř. 56–59, ADR-005 ř. 38
	QUEUE_ASSEMBLY_CONCURRENCY: "queue.assembly_concurrency",
	QUEUE_DELIVERY_CONCURRENCY: "queue.delivery_concurrency",
	// CAP-022-R02, ADR-018
	OCR_TIMEOUT_SECONDS: "ocr.timeout_seconds",
	OCR_MEMORY_LIMIT_BYTES: "ocr.memory_limit_bytes",
	API_PAGE_SIZE_DEFAULT: "api.page_size_default",
	API_PAGE_SIZE_MAX: "api.page_size_max",
	API_MAX_REQUESTS_PER_MINUTE_PER_DEVICE: "api.max_requests_per_minute_per_device",
	AUDIT_EXPORT_BUFFER_MAX_RECORDS: "audit_export.buffer_max_records",
	SYSLOG_HOST: "syslog.SYSLOG_HOST",
	SYSLOG_PORT: "syslog.SYSLOG_PORT",
	SYSLOG_FORMAT: "syslog.SYSLOG_FORMAT",
	SYSLOG_TRANSPORT: "syslog.SYSLOG_TRANSPORT",
	SYSLOG_FRAMING: "syslog.SYSLOG_FRAMING",
	SYSLOG_ENTERPRISE_NUMBER: "syslog.SYSLOG_ENTERPRISE_NUMBER",
	PACS_HOST: "dicom_dimse.PACS_HOST",
	PACS_PORT: "dicom_dimse.PACS_PORT",
	PACS_AE_TITLE: "dicom_dimse.PACS_AE_TITLE",
	PACS_CALLING_AE_TITLE: "dicom_dimse.PACS_CALLING_AE_TITLE",
	PACS_WORKLIST_MODALITY: "dicom_dimse.PACS_WORKLIST_MODALITY",
	// CAP-021-R17, integrace-dicom.md 3, konfigurace-a-profily.md 2.1
	DICOM_IMAGE_TRANSFER_SYNTAXES: "dicom.image_transfer_syntaxes",
	DICOM_DOCUMENT_TRANSFER_SYNTAXES: "dicom.document_transfer_syntaxes",
	// CAP-012-R17, CAP-021-R12, integrace-dicom.md 4, 5.0
	DICOM_IMPLEMENTATION_CLASS_UID: "dicom.implementation_class_uid",
	// ADR-005 ř. 39, integrace-dicom.md 6.3, konfigurace-a-profily.md 2.7
	DICOM_CONNECT_TIMEOUT_SECONDS: "dicom.connect_timeout_seconds",
	DICOM_ACSE_TIMEOUT_SECONDS: "dicom.acse_timeout_seconds",
	DICOM_DIMSE_TIMEOUT_SECONDS: "dicom.dimse_timeout_seconds",
	DICOM_IDLE_TIMEOUT_SECONDS: "dicom.idle_timeout_seconds",
	// TS-059, integrace-dicom.md 6.3, 10
	DICOM_MAX_PDU_LENGTH: "dicom.max_pdu_length",
	CLINICAL_RECORD_BASE_URL: "clinical_record_medplum.MEDPLUM_BASE_URL",
	// ADR-050 bod 2, konfigurace-a-profily.md 2.1
	CLINICAL_RECORD_INSTANCE_BASE_URI: "clinical_record_medplum.INSTANCE_BASE_URI",
	// ADR-053 (doplnění 2026-09-24) bod 1, CAP-011-R02, konfigurace-a-profily.md 2.1
	CLINICAL_RECORD_STORAGE_URL: "clinical_record_medplum.STORAGE_URL",
} as const

export type ConfigurationKey = (typeof CONFIGURATION_KEY)[keyof typeof CONFIGURATION_KEY]

// CAP-012-R01, CAP-012-S01, konfigurace-a-profily.md 2.1
export const PACS_CONNECTION_KEYS: readonly ConfigurationKey[] = [
	CONFIGURATION_KEY.PACS_HOST,
	CONFIGURATION_KEY.PACS_PORT,
	CONFIGURATION_KEY.PACS_AE_TITLE,
	CONFIGURATION_KEY.PACS_CALLING_AE_TITLE,
]

// CAP-005-R16, ADR-051
export const CARD_IDENTITY_MODE = {
	UID_BINDING: "uid_binding",
	CARD_APPLICATION_IDENTIFIER: "card_application_identifier",
	CUSTOMER_CARD_SYSTEM: "customer_card_system",
} as const

export type CardIdentityMode = (typeof CARD_IDENTITY_MODE)[keyof typeof CARD_IDENTITY_MODE]

// CAP-001-R15, CAP-001-R28
export const PIN_COMPLEXITY = {
	NONE: "none",
	STANDARD: "standard",
} as const

export type PinComplexity = (typeof PIN_COMPLEXITY)[keyof typeof PIN_COMPLEXITY]

// CAP-025-R08
export const SYSLOG_FORMAT = {
	RFC5424: "rfc5424",
	RFC3164: "rfc3164",
} as const

export type SyslogFormat = (typeof SYSLOG_FORMAT)[keyof typeof SYSLOG_FORMAT]

export const SYSLOG_TRANSPORT = {
	TLS: "tls",
	TCP: "tcp",
	UDP: "udp",
} as const

export type SyslogTransport = (typeof SYSLOG_TRANSPORT)[keyof typeof SYSLOG_TRANSPORT]

// RFC 6587
export const SYSLOG_FRAMING = {
	OCTET_COUNTING: "octet_counting",
	NON_TRANSPARENT: "non_transparent",
} as const

export type SyslogFraming = (typeof SYSLOG_FRAMING)[keyof typeof SYSLOG_FRAMING]

export type ConfigurationWarningCode = components["schemas"]["ConfigurationWarning"]["code"]

// CAP-012-R26, CAP-012-S17
export const CONFIGURATION_WARNING = {
	ALL_QUICK_LOGIN_METHODS_DISABLED: "all_quick_login_methods_disabled",
	OUTBOUND_ALLOWLIST_UPDATE_REQUIRED: "outbound_allowlist_update_required",
} as const satisfies Record<string, ConfigurationWarningCode>

export type PatientTagSource = NonNullable<
	mobileComponents["schemas"]["EffectiveConfiguration"]["patient_tag"]
>["source"]

// CAP-013-R05
export const PATIENT_TAG_SOURCE = {
	NDEF_TEXT: "ndef_text",
	UID: "uid",
} as const satisfies Record<string, PatientTagSource>
