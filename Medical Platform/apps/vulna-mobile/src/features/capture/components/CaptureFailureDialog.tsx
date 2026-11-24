import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { type RemoteFailureText, remoteFailureTextOf } from "../../remote/remote-failure-text"
import { CAPTURE_FAILURE, type CaptureFailure } from "../capture-failure"

interface Props {
	failure: CaptureFailure | undefined
	onDismiss: () => void
	onRetryCamera?: () => void
}

// E17, E18, E24, E70, E115, E129, E130
function failureTextOf(failure: CaptureFailure, texts: Texts): RemoteFailureText {
	const failures = texts.capture.failure
	switch (failure) {
		case CAPTURE_FAILURE.QUEUE_FULL:
			return { heading: failures.queueFull.title, body: failures.queueFull.body }
		case CAPTURE_FAILURE.STORAGE_FULL:
			return { heading: failures.storageFull.title, body: failures.storageFull.body }
		case CAPTURE_FAILURE.UNREADABLE:
			return { heading: failures.unreadable.title, body: failures.unreadable.body }
		case CAPTURE_FAILURE.CHANGED:
			return { heading: texts.recordChanged.title, body: texts.recordChanged.body }
		case CAPTURE_FAILURE.CAMERA_UNAVAILABLE:
			return { heading: texts.cameraUnavailable.title, body: texts.cameraUnavailable.body }
		default:
			return remoteFailureTextOf(failure, failures.editFailed, texts)
	}
}

// CAP-015-R13, CAP-015-R21, CAP-015-S03, CAP-015-S06, E130
export function CaptureFailureDialog({ failure, onDismiss, onRetryCamera }: Props) {
	const texts = useTexts()
	if (failure === undefined) {
		return null
	}
	const { heading, body } = failureTextOf(failure, texts)
	const retry =
		failure === CAPTURE_FAILURE.CAMERA_UNAVAILABLE && onRetryCamera !== undefined
			? { label: texts.cameraUnavailable.retry, onPress: onRetryCamera }
			: undefined
	return (
		<ConfirmDialog
			title={heading}
			body={body}
			primary={retry}
			secondary={{ label: texts.capture.failure.close, onPress: onDismiss }}
		/>
	)
}
