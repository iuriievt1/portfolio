import type { components as AdministrationComponents } from "./generated/administration"
import type { components as MobileComponents } from "./generated/mobile"

type AdministrationSchemas = AdministrationComponents["schemas"]

export type DraftDiscardReason = AdministrationSchemas["DraftDiscardReason"]

// CAP-015-R19, administration.yaml DraftDiscardReason
export const DRAFT_DISCARD_REASON = {
	OPERATOR_REVOKED: "operator_revoked",
	OPERATOR_DEPARTED: "operator_departed",
	LONG_ABSENCE: "long_absence",
	DEVICE_REASSIGNED: "device_reassigned",
} as const satisfies Record<string, DraftDiscardReason>

export const DRAFT_DISCARD_REASONS: readonly DraftDiscardReason[] = Object.values(DRAFT_DISCARD_REASON)

export type DraftDiscardRefusal = AdministrationSchemas["DraftDiscardResult"]["refused"][number]["reason"]

// CAP-015-R20
export const DRAFT_DISCARD_REFUSAL = {
	CHANGED: "changed",
	CLOSED: "closed",
	NOT_FOUND: "not_found",
} as const satisfies Record<string, DraftDiscardRefusal>

export type OperatorState = AdministrationSchemas["AcquisitionDraftForAdministration"]["operator_state"]

// CAP-005-R07, CAP-015-R19
export const OPERATOR_STATE = {
	ACTIVE: "active",
	REVOKED: "revoked",
} as const satisfies Record<string, OperatorState>

export type OperatorNotificationKind = MobileComponents["schemas"]["OperatorNotification"]["kind"]

// CAP-015-R18, CAP-015-R20, clinical-workflow.yaml OperatorNotification
export const OPERATOR_NOTIFICATION_KIND = {
	DRAFT_DISCARDED_BY_ADMINISTRATOR: "draft_discarded_by_administrator",
	DRAFT_REMINDER: "draft_reminder",
} as const satisfies Record<string, OperatorNotificationKind>
