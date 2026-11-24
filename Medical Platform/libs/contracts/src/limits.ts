// identity.yaml personal_number
export const PERSONAL_NUMBER_MAX_LENGTH = 128

// administration.yaml User login_name
export const LOGIN_NAME_MAX_LENGTH = 256

// administration.yaml User email, RFC 5321 4.5.3.1
export const EMAIL_MAX_LENGTH = 254

// index.yaml LanguageCode
export const LANGUAGE_CODE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/
export const LANGUAGE_CODE_MIN_LENGTH = 2
export const LANGUAGE_CODE_MAX_LENGTH = 35

// identity.yaml DeviceEventBatch events
export const DEVICE_EVENT_BATCH_MAX_EVENTS = 500

// identity.yaml AuthorizationEndpointMismatchDetails
export const DEVICE_EVENT_URL_MAX_LENGTH = 2048

// administration.yaml setUserDepartment department
export const DEPARTMENT_CODE_MAX_LENGTH = 128

// configuration mobile_app.minimum_version, X-Vulna-App-Version
export const APP_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

// DICOM PS3.5 9.1, 6.2 UI, configuration dicom.implementation_class_uid
export const DICOM_UID_PATTERN = /^(?=.{1,64}$)[0-2](\.(0|[1-9]\d*))+$/

// DICOM PS3.5 6.2 AE, integrace-dicom.md 6.1, configuration dicom_dimse.PACS_AE_TITLE, PACS_CALLING_AE_TITLE
export const DICOM_AE_TITLE_PATTERN = /^[\x21-\x5b\x5d-\x7e]([\x20-\x5b\x5d-\x7e]{0,14}[\x21-\x5b\x5d-\x7e])?$/

// configuration dicom_dimse.PACS_HOST, syslog.SYSLOG_HOST
export const HOST_NAME_PATTERN = /^[A-Za-z0-9.:[\]-]+$/

// administration.yaml DeviceApproval fingerprint
export const DEVICE_FINGERPRINT_PATTERN = /^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/

// administration.yaml unblockDevice reason, 0050-device-blocking.sql
export const DEVICE_UNBLOCK_REASON_MAX_LENGTH = 2000

// administration.yaml DeliveryClosure.note
export const DELIVERY_CLOSURE_NOTE_MAX_LENGTH = 2000

// administration.yaml TextRecognitionRestart.reason
export const TEXT_RECOGNITION_RESTART_REASON_MAX_LENGTH = 2000

// administration.yaml OrphanedObjectDeletion.reason
export const ORPHANED_OBJECT_DELETION_REASON_MAX_LENGTH = 2000

// administration.yaml BlockingReview app_version, 0050-device-blocking.sql
export const BLOCKING_APP_VERSION_MAX_LENGTH = 50

// administration.yaml listUsers search
export const USER_SEARCH_MAX_LENGTH = 200

// index.yaml Limit
export const PAGE_LIMIT_MAX = 500

// clinical-workflow.yaml getQueueState acquisition_keys
export const QUEUE_STATE_KEYS_MAX = 500

// administration.yaml DeviceGroupWrite, 0004-devices.sql
export const DEVICE_GROUP_CODE_MAX_LENGTH = 100
export const DEVICE_GROUP_NAME_MAX_LENGTH = 200

// administration.yaml ConfigurationChange reason
export const CONFIGURATION_REASON_MAX_LENGTH = 2000

// administration.yaml searchAudit, exportAudit
export const AUDIT_TEXT_FILTER_MAX_LENGTH = 200
export const AUDIT_CODE_FILTER_MAX_LENGTH = 100

// clinical-workflow.yaml findPatients, CAP-013-R17, CHG-182
export const PATIENT_SEARCH_QUERY_MIN_LENGTH = 3
export const PATIENT_SEARCH_QUERY_MAX_LENGTH = 255

// clinical-workflow.yaml PatientIdentification value, DICOM PS3.5 6.2
export const PATIENT_IDENTIFIER_VALUE_MAX_LENGTH = 64
// biome-ignore lint/suspicious/noControlCharactersInRegex: DICOM PS3.5 6.2
export const PATIENT_IDENTIFIER_VALUE_PATTERN = /^[^\\\u0000-\u001f\u007f-\u009f]+$/
