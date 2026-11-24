import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { errorCodeOf } from "@/api/client"
import cs from "@/i18n/cs.json"

export type MessageByCode = Readonly<Record<string, string>>

const MESSAGE_BY_CODE: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.NOT_FOUND]: cs.errors.notFound,
	[ADMINISTRATION_ERROR_CODE.PERMISSION_DENIED]: cs.errors.permissionDenied,
	[ADMINISTRATION_ERROR_CODE.CARD_BINDING_NOT_APPLICABLE]: cs.errors.cardBindingNotApplicable,
}

export const DEVICE_APPROVAL_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.DEVICE_NOT_PENDING]: cs.errors.deviceNotPending,
}

// CAP-007-S07
export const DEVICE_UNBLOCKING_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.DEVICE_NOT_BLOCKED]: cs.errors.deviceNotBlocked,
}

export const CONFIGURATION_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT]: cs.errors.versionConflict,
	[ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE]: cs.errors.valueOutOfRange,
	[ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NOT_SUPPORTED]: cs.errors.defaultLanguageNotSupported,
	[ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NAMES_MISSING]: cs.errors.defaultLanguageNamesMissing,
}

// CAP-017-R18, CAP-017-S08, CAP-017-S09
export const CODE_LIST_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_NAME_MISSING]: cs.errors.codeListItemNameMissing,
	[ADMINISTRATION_ERROR_CODE.CODE_LIST_ITEM_UNKNOWN]: cs.errors.codeListItemUnknown,
}

// CAP-015-R19, CAP-015-S20
export const DRAFT_DISCARD_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.DRAFT_DISCARD_NOT_ALLOWED]: cs.errors.draftDiscardNotAllowed,
}

// CAP-003-R07
export const USER_DEPARTMENT_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.DEPARTMENT_FROM_DIRECTORY]: cs.errors.departmentFromDirectory,
}

// CAP-023-R23
export const TARGET_RESUMPTION_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.TARGET_NOT_PAUSED]: cs.errors.targetNotPaused,
}

// CAP-023-R26
export const VERIFICATION_RESUMPTION_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.VERIFICATION_NOT_ON_HOLD]: cs.errors.verificationNotOnHold,
}

// CAP-023-R28
export const DELIVERY_CLOSURE_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.DELIVERY_NOT_CLOSABLE]: cs.errors.deliveryNotClosable,
}

// CAP-022-R15
export const TEXT_RECOGNITION_RESTART_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.TEXT_RECOGNITION_NOT_FAILED]: cs.errors.textRecognitionNotFailed,
}

// CAP-026-R14, stavy-a-mikrocopy.md 4
export const ORPHANED_OBJECT_DELETION_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.ORPHANED_OBJECT_NOT_SET_ASIDE]: cs.errors.orphanedObjectNotSetAside,
}

export const CARRIER_ISSUE_MESSAGES: MessageByCode = {
	[ADMINISTRATION_ERROR_CODE.RECORD_REJECTED]: cs.errors.userInactive,
}

export function errorMessageOf(error: unknown, specific: MessageByCode = {}): string {
	const code = errorCodeOf(error)
	if (code === undefined) {
		return cs.errors.generic
	}
	return specific[code] ?? MESSAGE_BY_CODE[code] ?? cs.errors.generic
}
