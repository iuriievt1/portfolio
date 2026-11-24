import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { fillText } from "../../../utils/fill-text"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { CANCELLATION, CANCELLATION_REFUSAL, type Cancellation } from "../hooks/use-visit-cancellation"

interface Props {
	cancellation: Cancellation
	when: string
	onConfirm: () => void
	onDismiss: () => void
	onRefused: () => void
}

// Q-150, E70, E129
export function CancellationDialogs({ cancellation, when, onConfirm, onDismiss, onRefused }: Props) {
	const texts = useTexts()
	const cancel = texts.visit.cancel
	switch (cancellation.kind) {
		case CANCELLATION.IDLE:
		case CANCELLATION.CANCELLING:
			return null
		case CANCELLATION.CONFIRMING:
			return (
				<ConfirmDialog
					title={cancel.confirm.title}
					body={fillText(cancel.confirm.body, { when }, texts.language)}
					destructive={{ label: cancel.confirm.confirm, onPress: onConfirm }}
					secondary={{ label: cancel.confirm.keep, onPress: onDismiss }}
				/>
			)
		case CANCELLATION.REFUSED:
			return (
				<ConfirmDialog
					title={cancel.refused.title}
					body={
						cancellation.refusal === CANCELLATION_REFUSAL.CLOSED_RECORD
							? cancel.refused.closedRecord
							: cancel.refused.completed
					}
					secondary={{ label: cancel.close, onPress: onRefused }}
				/>
			)
		case CANCELLATION.FAILED:
			return (
				<RemoteFailureDialog
					failure={cancellation.failure}
					serverErrorHeading={cancel.failed}
					closeLabel={cancel.close}
					onClose={onDismiss}
				/>
			)
		default:
			return cancellation satisfies never
	}
}
