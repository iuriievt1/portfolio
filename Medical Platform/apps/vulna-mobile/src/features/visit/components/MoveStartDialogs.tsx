import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { RemoteFailureDialog } from "../../remote/components/RemoteFailureDialog"
import { MOVE_START, type MoveStart } from "../hooks/use-move-start"

interface Props {
	moveStart: MoveStart
	onDismiss: () => void
	onClosedSeen: () => void
}

// CAP-014-R25, CAP-014-S05, E25, E70, E129
export function MoveStartDialogs({ moveStart, onDismiss, onClosedSeen }: Props) {
	const texts = useTexts().move
	switch (moveStart.kind) {
		case MOVE_START.IDLE:
		case MOVE_START.LOADING:
			return null
		case MOVE_START.CLOSED:
			return (
				<ConfirmDialog
					title={texts.closed.title}
					body={texts.closed.body}
					secondary={{ label: texts.close, onPress: onClosedSeen }}
				/>
			)
		case MOVE_START.FAILED:
			return (
				<RemoteFailureDialog
					failure={moveStart.failure}
					serverErrorHeading={texts.failed}
					closeLabel={texts.close}
					onClose={onDismiss}
				/>
			)
		default:
			return moveStart satisfies never
	}
}
