import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import type { RecordClosing } from "../hooks/use-record-cancellation"
import { RECORD_CANCELLATION } from "../record-cancellation"

interface Props {
	kind: AcquisitionKind
	closing: RecordClosing
}

// CAP-015-R37, CAP-015-S54, CAP-018-S11, CAP-002-R17, E119, E70, E115
export function RecordCancellationDialogs({ kind, closing }: Props) {
	const texts = useTexts()
	const actions = texts.capture.closeEmpty
	const { cancellation } = closing
	switch (cancellation.kind) {
		case RECORD_CANCELLATION.IDLE:
			return null
		case RECORD_CANCELLATION.ASKING:
		case RECORD_CANCELLATION.CANCELLING: {
			const isCancelling = cancellation.kind === RECORD_CANCELLATION.CANCELLING
			const question = questionOf(kind, texts)
			return (
				<ConfirmDialog
					title={question.title}
					body={question.body}
					destructive={{
						label: actions.cancelRecord,
						onPress: () => void closing.cancelRecord(),
						disabled: isCancelling,
					}}
					secondary={{ label: actions.keepDraft, onPress: closing.leave, disabled: isCancelling }}
				/>
			)
		}
		case RECORD_CANCELLATION.CHANGED:
			return (
				<ConfirmDialog
					title={texts.recordChanged.title}
					body={texts.recordChanged.body}
					secondary={{ label: texts.recordChanged.close, onPress: closing.leave }}
				/>
			)
		case RECORD_CANCELLATION.FAILED:
			return (
				<RemoteFailureDialog
					failure={cancellation.failure}
					serverErrorHeading={actions.failed}
					closeLabel={texts.capture.failure.close}
					onClose={closing.dismissFailure}
				/>
			)
		default:
			return cancellation satisfies never
	}
}

// E119
function questionOf(kind: AcquisitionKind, texts: Texts): { title: string; body: string } {
	switch (kind) {
		case ACQUISITION_KIND.PHOTO:
			return texts.capture.closeEmpty
		case ACQUISITION_KIND.SCAN:
			return texts.scan.closeEmpty
		default:
			return kind satisfies never
	}
}
