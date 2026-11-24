import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { openedPatient } from "../../../../../features/patient/opened-patient"
import { WoundDetailScreen } from "../../../../../features/wounds/components/WoundDetailScreen"
import { useWoundHistory } from "../../../../../features/wounds/hooks/use-wound-history"
import { ROUTE } from "../../../../../navigation/routes"

// CAP-020-R02, CAP-020-R21
export default function WoundRoute() {
	const { id, findingId } = useLocalSearchParams<{ id: string; findingId: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <Wound patient={patient} findingId={findingId} />
}

function Wound({ patient, findingId }: { patient: Patient; findingId: string }) {
	const router = useRouter()
	const { state, retry } = useWoundHistory(findingId)
	return (
		<WoundDetailScreen
			patient={patient}
			state={state}
			onBack={() => router.back()}
			onRetry={retry}
			onChangeType={(current) =>
				router.push({
					pathname: ROUTE.WOUND_TYPE,
					params: { id: patient.patient_id, findingId, current },
				})
			}
			onOpenRecord={(acquisitionId) => router.push({ pathname: ROUTE.RECORD_DETAIL, params: { id: acquisitionId } })}
			onOpenImage={(acquisitionId, imageId) =>
				router.push({ pathname: ROUTE.RECORD_VIEWER, params: { id: acquisitionId, file: imageId } })
			}
		/>
	)
}
