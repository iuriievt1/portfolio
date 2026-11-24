import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { STEP_SAVE_FAILURE, type StepSaveFailure } from "../hooks/use-draft-step-save"

interface Props {
	failure: StepSaveFailure | undefined
	serverErrorHeading: string
	onDismiss: () => void
	onReload: () => void
}

// CAP-021-R32, CAP-002-R17, E115
export function DraftStepDialogs({ failure, serverErrorHeading, onDismiss, onReload }: Props) {
	const texts = useTexts()
	if (failure === undefined) {
		return null
	}
	switch (failure.kind) {
		case STEP_SAVE_FAILURE.CHANGED:
			return (
				<ConfirmDialog
					title={texts.recordChanged.title}
					body={texts.recordChanged.body}
					secondary={{ label: texts.recordChanged.close, onPress: onReload }}
				/>
			)
		case STEP_SAVE_FAILURE.REMOTE:
			return (
				<RemoteFailureDialog
					failure={failure.failure}
					serverErrorHeading={serverErrorHeading}
					closeLabel={texts.capture.save.close}
					onClose={onDismiss}
				/>
			)
		default:
			return failure satisfies never
	}
}
