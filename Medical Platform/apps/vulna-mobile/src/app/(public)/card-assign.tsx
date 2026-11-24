import { Redirect } from "expo-router"
import { CardAssignFeedback } from "../../features/card-assign/components/CardAssignFeedback"
import { CardAssignStep } from "../../features/card-assign/components/CardAssignStep"
import { CARD_ASSIGN_FAILURE, CARD_ASSIGN_PHASE, useCardAssign } from "../../features/card-assign/hooks/use-card-assign"
import { ROUTE } from "../../navigation/routes"
import { openNfcSettings } from "../../utils/open-nfc-settings"
import { openSettings } from "../../utils/open-settings"

export default function CardAssign() {
	const assign = useCardAssign()
	const { phase } = assign
	if (phase.kind !== CARD_ASSIGN_PHASE.FAILED) {
		return <CardAssignStep phase={phase} onClose={assign.close} />
	}
	if (phase.failure === CARD_ASSIGN_FAILURE.DEVICE) {
		return <Redirect href={ROUTE.ENTRY} />
	}
	return (
		<CardAssignFeedback
			failure={phase.failure}
			onReadCard={assign.readCard}
			onBindAgain={assign.bindAgain}
			onOpenSettings={openSettings}
			onOpenNfcSettings={openNfcSettings}
			onClose={assign.close}
		/>
	)
}
