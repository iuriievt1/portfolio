import { DISCARD_SITUATION } from "@ansora/contracts"
import { useRouter } from "expo-router"
import { View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { ROUTE } from "../../../navigation/routes"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { openOwnDraftSummary } from "../../drafts/open-own-draft"
import { SignOutDialogs } from "../../session/components/SignOutDialogs"
import { SignOutNotice } from "../../session/components/SignOutNotice"
import { useSignOut } from "../../session/hooks/use-sign-out"

// CAP-002-R14, CAP-002-S02, CAP-015-R16
export function SignOutSection() {
	const texts = useTexts().session.signOut
	const router = useRouter()
	const flow = useSignOut()

	return (
		<View className="gap-3">
			<SignOutNotice state={flow.state} onRetry={flow.signOut} />
			<Button label={texts.action} style={BUTTON_STYLE.SECONDARY} waiting={flow.isBusy} onPress={flow.signOut} />
			<SignOutDialogs
				flow={flow}
				canDiscard
				onCloseThroughSummary={(draft) => {
					flow.closeThroughSummary(draft)
					router.replace(openOwnDraftSummary(draft))
				}}
				onShowDrafts={() => router.replace({ pathname: ROUTE.DRAFTS, params: { situation: DISCARD_SITUATION.LOGOUT } })}
				onShowQueue={() => router.replace(ROUTE.QUEUE)}
			/>
		</View>
	)
}
