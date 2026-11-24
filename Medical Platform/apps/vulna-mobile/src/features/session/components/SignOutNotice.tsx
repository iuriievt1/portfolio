import { useTexts } from "../../../i18n/language-store"
import { Notice } from "../../../ui/Notice"
import { SIGN_OUT_STATE, type SignOutState } from "../sign-out-state"

interface Props {
	state: SignOutState
	onRetry: () => void
}

// CAP-002-R17
export function SignOutNotice({ state, onRetry }: Props) {
	const texts = useTexts().session.signOut
	if (state.kind === SIGN_OUT_STATE.OFFLINE) {
		return (
			<Notice
				heading={texts.offline.heading}
				body={texts.offline.body}
				action={{ label: texts.offline.action, onPress: onRetry }}
			/>
		)
	}
	if (state.kind === SIGN_OUT_STATE.REJECTED) {
		return <Notice heading={texts.rejected.heading} body={texts.rejected.body} />
	}
	return null
}
