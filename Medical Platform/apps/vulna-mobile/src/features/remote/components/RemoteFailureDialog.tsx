import type { RemoteFailure } from "../../../api/remote-failure"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { remoteFailureTextOf } from "../remote-failure-text"

interface Props {
	failure: RemoteFailure
	serverErrorHeading: string
	closeLabel: string
	onClose: () => void
}

// CAP-002-R17, ADR-054 bod 5, E70, E129
export function RemoteFailureDialog({ failure, serverErrorHeading, closeLabel, onClose }: Props) {
	const { heading, body } = remoteFailureTextOf(failure, serverErrorHeading, useTexts())
	return <ConfirmDialog title={heading} body={body} secondary={{ label: closeLabel, onPress: onClose }} />
}
