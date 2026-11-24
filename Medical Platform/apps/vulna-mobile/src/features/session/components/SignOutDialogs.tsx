import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { DraftDiscardDialogs } from "../../drafts/components/DraftDiscardDialogs"
import type { SignOutFlow } from "../hooks/use-sign-out"
import { SIGN_OUT_STATE } from "../sign-out-state"
import { unclosedDraftsTextOf, unclosedDraftTextOf, uploadingTextOf } from "../sign-out-text"

interface Props {
	flow: SignOutFlow
	canDiscard: boolean
	onCloseThroughSummary: (draft: AcquisitionDraftSummary) => void
	onShowDrafts: (() => void) | undefined
	onShowQueue: (() => void) | undefined
}

// CAP-015-R16, CAP-015-S09, CAP-002-R14, CAP-002-S12, CAP-019-S21, E9, E40, E53
export function SignOutDialogs(props: Props) {
	const { flow } = props
	return (
		<>
			<OwnWorkDialog {...props} />
			<DraftDiscardDialogs discard={flow.discard} onConfirm={flow.confirmDiscard} onDismiss={flow.dismissDiscard} />
		</>
	)
}

function OwnWorkDialog({ flow, canDiscard, onCloseThroughSummary, onShowDrafts, onShowQueue }: Props) {
	const texts = useTexts()
	const signOut = texts.session.signOut
	const { state } = flow
	const leave = { label: signOut.leave, onPress: flow.leave }
	const cancel = { label: signOut.cancel, onPress: flow.dismiss }
	switch (state.kind) {
		case SIGN_OUT_STATE.UNCLOSED_DRAFT: {
			const { draft } = state
			return (
				<ConfirmDialog
					title={signOut.unclosed.title}
					body={unclosedDraftTextOf(draft, canDiscard, texts)}
					primary={{ label: signOut.unclosed.close, onPress: () => onCloseThroughSummary(draft) }}
					alternative={leave}
					destructive={
						canDiscard ? { label: signOut.unclosed.discard, onPress: () => flow.discardDraft(draft) } : undefined
					}
					secondary={cancel}
				/>
			)
		}
		case SIGN_OUT_STATE.UNCLOSED_DRAFTS:
			return (
				<ConfirmDialog
					title={signOut.unclosedMany.title}
					body={unclosedDraftsTextOf(state.count, texts)}
					primary={onShowDrafts === undefined ? undefined : { label: signOut.unclosedMany.show, onPress: onShowDrafts }}
					alternative={leave}
					secondary={cancel}
				/>
			)
		case SIGN_OUT_STATE.FILES_UPLOADING:
			return (
				<ConfirmDialog
					title={signOut.uploading.title}
					body={uploadingTextOf(state.count, state.isClosingQueued, texts)}
					primary={{ label: signOut.uploading.continue, onPress: flow.dismiss }}
					alternative={onShowQueue === undefined ? undefined : { label: signOut.uploading.queue, onPress: onShowQueue }}
				/>
			)
		case SIGN_OUT_STATE.CLOSING_QUEUED:
			return (
				<ConfirmDialog
					title={signOut.closingQueuedTitle}
					body={texts.unlock.sessionEnded.closingQueued}
					primary={{ label: signOut.uploading.continue, onPress: flow.dismiss }}
					alternative={{ label: signOut.action, onPress: flow.leaveWithQueuedClosing }}
				/>
			)
		case SIGN_OUT_STATE.IDLE:
		case SIGN_OUT_STATE.CHECKING:
		case SIGN_OUT_STATE.SIGNING_OUT:
		case SIGN_OUT_STATE.OFFLINE:
		case SIGN_OUT_STATE.REJECTED:
			return null
		default:
			return state satisfies never
	}
}
