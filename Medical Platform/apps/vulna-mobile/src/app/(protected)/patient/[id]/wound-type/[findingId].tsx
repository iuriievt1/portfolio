import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback } from "react"
import type { Patient } from "../../../../../api/patients"
import { useWoundTypes } from "../../../../../features/assessment/hooks/use-code-list-items"
import { useHoldScreen } from "../../../../../features/capture/hooks/use-hold-screen"
import { openedPatient } from "../../../../../features/patient/opened-patient"
import { WoundTypeScreen } from "../../../../../features/wounds/components/WoundTypeScreen"
import { useWoundTypeChange } from "../../../../../features/wounds/hooks/use-wound-type-change"
import { TYPE_CHANGE } from "../../../../../features/wounds/type-change"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	patient: Patient
	findingId: string
	current: string
}

// CAP-020-R21, E122
export default function WoundTypeRoute() {
	const { id, findingId, current } = useLocalSearchParams<{ id: string; findingId: string; current: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <WoundType patient={patient} findingId={findingId} current={current} />
}

function WoundType({ patient, findingId, current }: Props) {
	const router = useRouter()
	const close = useCallback(() => router.back(), [router])
	const choices = useWoundTypes()
	const change = useWoundTypeChange({ findingId, current }, close)
	// CAP-020-R21
	useHoldScreen(change.step.kind === TYPE_CHANGE.CHANGING)
	return (
		<WoundTypeScreen
			patient={patient}
			choices={choices.state}
			selectedCode={change.known}
			step={change.step}
			onRetry={choices.retry}
			onClose={close}
			onSelect={change.choose}
			onConfirm={() => void change.confirm()}
			onDismiss={change.dismiss}
		/>
	)
}
