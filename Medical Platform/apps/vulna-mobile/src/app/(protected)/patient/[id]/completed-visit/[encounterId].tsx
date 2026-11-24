import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { CompletedVisitScreen } from "../../../../../features/history/components/CompletedVisitScreen"
import { useCompletedVisit } from "../../../../../features/history/hooks/use-completed-visit"
import { openedPatient } from "../../../../../features/patient/opened-patient"
import { ROUTE } from "../../../../../navigation/routes"

// CAP-014-R21, E105
export default function CompletedVisitRoute() {
	const { id, encounterId } = useLocalSearchParams<{ id: string; encounterId: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <CompletedVisit patient={patient} encounterId={encounterId} />
}

function CompletedVisit({ patient, encounterId }: { patient: Patient; encounterId: string }) {
	const router = useRouter()
	const { state, retry, loadMore } = useCompletedVisit(encounterId)
	return (
		<CompletedVisitScreen
			patient={patient}
			state={state}
			onBack={() => router.back()}
			onRetry={retry}
			onMore={() => void loadMore()}
			onOpenRecord={(record) => router.push({ pathname: ROUTE.RECORD_DETAIL, params: { id: record.acquisition_id } })}
		/>
	)
}
