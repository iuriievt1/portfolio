import { ACQUISITION_KIND, type AcquisitionKind, type MissingStep } from "@ansora/contracts"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ConfirmDialog, type DialogAction } from "../../../ui/ConfirmDialog"
import { missingStepsTextOf, queuedClosingTextOf } from "../closing"
import { CLOSING, type ClosingState } from "../hooks/use-record-closing"
import { firstWoundStepOf, WOUND_STEP, type WoundStep } from "../wound-step"

interface Props {
	kind: AcquisitionKind
	state: ClosingState
	onRetry: () => void
	onLater: () => void
	onDismiss: () => void
	onReload: () => void
	onQueuedSeen: () => void
	onFillStep?: (step: WoundStep) => void
}

// E107
function fillStepActionOf(
	steps: readonly MissingStep[],
	onFillStep: ((step: WoundStep) => void) | undefined,
	texts: Texts,
): DialogAction | undefined {
	const step = firstWoundStepOf(steps)
	if (step === undefined || onFillStep === undefined) {
		return undefined
	}
	const missing = texts.capture.closing.missing
	return {
		label: step === WOUND_STEP.LOCATION ? missing.markLocation : missing.addHealingPhase,
		onPress: () => onFillStep(step),
	}
}

// E70, E93, E107, E111, E112, E115, E129, CAP-009-S05, Q-076, Figma 05 H.3–H.5, Figma 06 G
export function ClosingDialogs({
	kind,
	state,
	onRetry,
	onLater,
	onDismiss,
	onReload,
	onQueuedSeen,
	onFillStep,
}: Props) {
	const texts = useTexts()
	const closing = texts.capture.closing
	const isScan = kind === ACQUISITION_KIND.SCAN
	switch (state.kind) {
		case CLOSING.IDLE:
		case CLOSING.CLOSING:
		case CLOSING.CLOSED:
			return null
		case CLOSING.NO_RESPONSE:
			return (
				<ConfirmDialog
					title={closing.noResponse.title}
					body={isScan ? closing.noResponse.bodyScan : closing.noResponse.body}
					primary={{ label: closing.noResponse.retry, onPress: onRetry }}
					secondary={{ label: closing.noResponse.later, onPress: onLater }}
				/>
			)
		case CLOSING.QUEUED:
			return (
				<ConfirmDialog
					title={closing.queued.title}
					body={queuedClosingTextOf(state.remaining, texts)}
					primary={{ label: closing.ok, onPress: onQueuedSeen }}
				/>
			)
		case CLOSING.DOCUMENTATION_UNAVAILABLE:
			return (
				<ConfirmDialog
					title={texts.remote.documentationUnavailable.heading}
					body={texts.remote.documentationUnavailable.body}
					primary={{ label: closing.noResponse.retry, onPress: onRetry }}
					secondary={{ label: closing.noResponse.later, onPress: onLater }}
				/>
			)
		case CLOSING.REJECTED:
			return (
				<ConfirmDialog
					title={isScan ? closing.rejected.titleScan : closing.rejected.title}
					body={isScan ? closing.rejected.bodyScan : closing.rejected.body}
					primary={{ label: closing.ok, onPress: onDismiss }}
				/>
			)
		case CLOSING.UNREADABLE:
			return (
				<ConfirmDialog
					title={isScan ? closing.unreadable.titleScan : closing.unreadable.title}
					body={isScan ? closing.unreadable.bodyScan : closing.unreadable.body}
					primary={{ label: closing.ok, onPress: onDismiss }}
				/>
			)
		case CLOSING.CHANGED:
			return (
				<ConfirmDialog
					title={texts.recordChanged.title}
					body={closing.changed.body}
					primary={{ label: closing.ok, onPress: onReload }}
				/>
			)
		case CLOSING.OTHER_DEVICE:
			return (
				<ConfirmDialog
					title={isScan ? closing.otherDevice.titleScan : closing.otherDevice.title}
					body={isScan ? closing.otherDevice.bodyScan : closing.otherDevice.body}
					secondary={{ label: closing.close, onPress: onDismiss }}
				/>
			)
		case CLOSING.MISSING:
			return (
				<ConfirmDialog
					title={closing.missing.title}
					body={missingStepsTextOf(state.steps, texts)}
					primary={fillStepActionOf(state.steps, onFillStep, texts)}
					secondary={{ label: closing.close, onPress: onDismiss }}
				/>
			)
		default:
			return state satisfies never
	}
}
