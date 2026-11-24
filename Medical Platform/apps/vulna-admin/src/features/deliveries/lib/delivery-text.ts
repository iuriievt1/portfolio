import {
	DELIVERY_INSTANCE_STATE,
	DELIVERY_INSTANCE_STATES,
	type DeliveryClosureReason,
	type DeliveryState,
	type DeliveryTargetState,
	HELD_FOR_REVIEW_CAUSE,
	type HeldForReviewCause,
} from "@ansora/contracts"
import { NOTICE_TONE, type NoticeTone } from "@/components/custom/notice"
import { PILL_TONE, type PillTone } from "@/components/custom/status-pill"
import { PACS_STATUS_TONE } from "@/features/acquisitions/constants/acquisition-tone"
import { kindText, pacsStatusText } from "@/features/acquisitions/lib/acquisition-text"
import type { Delivery, DeliveryInstance } from "@/features/deliveries/types/delivery.types"
import cs from "@/i18n/cs.json"
import { fillText, formatCount, formatDateTime } from "@/lib/format"

const texts = cs.deliveries
const explanation = texts.detail.explanation

const STATE_LABEL: Readonly<Record<DeliveryState, string>> = texts.state
const TARGET_STATE_LABEL: Readonly<Record<DeliveryTargetState, string>> = texts.target.state
const CLOSURE_REASON_LABEL: Readonly<Record<DeliveryClosureReason, string>> = texts.closeDialog.reasonValue
const ASSEMBLY_REASON_LABEL: Readonly<Record<string, string>> = texts.assemblyReason

// administration.yaml DeliveryInstance.last_dimse_status, CAP-023-R12
const WARNING_STATUS_PREFIX = "B"

const HELD_CAUSE_TEXT: Readonly<Record<HeldForReviewCause, string>> = {
	[HELD_FOR_REVIEW_CAUSE.DIMSE_STATUS]: explanation.dimseStatus,
	[HELD_FOR_REVIEW_CAUSE.ARTIFACT_SHA256_MISMATCH]: explanation.artifactSha256Mismatch,
	[HELD_FOR_REVIEW_CAUSE.STUDY_IDENTITY_CONFLICT]: explanation.studyIdentityConflict,
}

interface InstanceDisplay {
	label: string
	tone: PillTone
}

interface InstanceCount extends InstanceDisplay {
	count: number
}

export const INSTANCE_NOTICE_KIND = {
	EXPLANATION: "explanation",
	VERIFICATION_ON_HOLD: "verification_on_hold",
} as const

export type InstanceNotice =
	| { kind: typeof INSTANCE_NOTICE_KIND.VERIFICATION_ON_HOLD; text: string }
	| { kind: typeof INSTANCE_NOTICE_KIND.EXPLANATION; tone: NoticeTone; title: string | undefined; text: string }

// NAB-345, administration.yaml Delivery acquisition_kind, acquisition_closed_at
export function recordText(delivery: Delivery): string {
	return fillText(texts.record, {
		kind: kindText(delivery.acquisition_kind),
		closedAt: formatDateTime(delivery.acquisition_closed_at),
	})
}

export function deliveryStateText(state: DeliveryState): string {
	return STATE_LABEL[state]
}

export function targetStateText(state: DeliveryTargetState): string {
	return TARGET_STATE_LABEL[state]
}

export function closureReasonText(reason: DeliveryClosureReason): string {
	return CLOSURE_REASON_LABEL[reason]
}

// CAP-022-R11, stavy-a-mikrocopy.md 3.3
export function assemblyReasonText(reason: string): string | undefined {
	return ASSEMBLY_REASON_LABEL[reason]
}

// CAP-023-R12, CAP-023-S21
function isStoredWithWarning(instance: DeliveryInstance): boolean {
	return (
		instance.state === DELIVERY_INSTANCE_STATE.CONFIRMED &&
		instance.last_dimse_status?.startsWith(WARNING_STATUS_PREFIX) === true
	)
}

// CAP-023-R26, CAP-023-S18
function isVerificationOnHold(instance: DeliveryInstance): boolean {
	return instance.state === DELIVERY_INSTANCE_STATE.PENDING_VERIFICATION && instance.verification_on_hold_at !== null
}

// stavy-a-mikrocopy.md 3.3
export function instanceDisplayOf(instance: DeliveryInstance): InstanceDisplay {
	if (isStoredWithWarning(instance)) {
		return { label: texts.warnedStatus, tone: PILL_TONE.WARN }
	}
	if (isVerificationOnHold(instance)) {
		return { label: texts.onHoldStatus, tone: PILL_TONE.WARN }
	}
	return { label: pacsStatusText(instance.state), tone: PACS_STATUS_TONE[instance.state] }
}

// NAB-345
export function instanceCountsOf(delivery: Delivery): InstanceCount[] {
	const counts = new Map<string, InstanceCount>()
	for (const state of DELIVERY_INSTANCE_STATES) {
		for (const instance of delivery.instance.filter((candidate) => candidate.state === state)) {
			const display = instanceDisplayOf(instance)
			const count = counts.get(display.label)?.count ?? 0
			counts.set(display.label, { ...display, count: count + 1 })
		}
	}
	return [...counts.values()]
}

export function instanceCountText(entry: InstanceCount): string {
	return fillText(texts.instanceCount, { count: formatCount(entry.count), state: entry.label })
}

function statusText(instance: DeliveryInstance): string {
	return instance.last_dimse_status ?? cs.common.notStated
}

function heldExplanationOf(instance: DeliveryInstance): string | undefined {
	const cause = instance.held_for_review_cause
	return cause === null ? undefined : fillText(HELD_CAUSE_TEXT[cause], { status: statusText(instance) })
}

function failureExplanationOf(instance: DeliveryInstance): string | undefined {
	switch (instance.closure?.closed_from_state ?? instance.state) {
		case DELIVERY_INSTANCE_STATE.HELD_FOR_REVIEW:
			return heldExplanationOf(instance)
		case DELIVERY_INSTANCE_STATE.PERMANENTLY_FAILED:
			return fillText(explanation.permanentlyFailed, { status: statusText(instance) })
		default:
			return undefined
	}
}

// CAP-023-R09, CAP-023-R12, CAP-023-R17, CAP-023-R26, stavy-a-mikrocopy.md E63, E64, E65
export function instanceNoticeOf(instance: DeliveryInstance): InstanceNotice | undefined {
	if (isVerificationOnHold(instance)) {
		return {
			kind: INSTANCE_NOTICE_KIND.VERIFICATION_ON_HOLD,
			text: fillText(explanation.verificationOnHold, { count: formatCount(instance.verification_rejections) }),
		}
	}
	if (isStoredWithWarning(instance)) {
		return {
			kind: INSTANCE_NOTICE_KIND.EXPLANATION,
			tone: NOTICE_TONE.WARN,
			title: explanation.storedWithWarningTitle,
			text: fillText(explanation.storedWithWarning, { status: statusText(instance) }),
		}
	}
	const failure = failureExplanationOf(instance)
	if (failure === undefined) {
		return undefined
	}
	const tone = instance.closure === null ? NOTICE_TONE.CRITICAL : NOTICE_TONE.WARN
	return { kind: INSTANCE_NOTICE_KIND.EXPLANATION, tone, title: undefined, text: failure }
}
