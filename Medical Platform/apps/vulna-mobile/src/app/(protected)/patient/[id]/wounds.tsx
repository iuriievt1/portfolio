import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../api/patients"
import { openedPatient } from "../../../../features/patient/opened-patient"
import { WoundsScreen } from "../../../../features/wounds/components/WoundsScreen"
import { usePatientWounds } from "../../../../features/wounds/hooks/use-patient-wounds"
import { ROUTE } from "../../../../navigation/routes"

// CAP-020-R01, CAP-020-S01
export default function PatientWoundsRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <PatientWounds patient={patient} />
}

function PatientWounds({ patient }: { patient: Patient }) {
	const router = useRouter()
	const { state, retry, loadMore } = usePatientWounds(patient.patient_id)
	return (
		<WoundsScreen
			patient={patient}
			state={state}
			onBack={() => router.back()}
			onRetry={retry}
			onMore={() => void loadMore()}
			onOpen={(finding) =>
				router.push({
					pathname: ROUTE.WOUND,
					params: { id: patient.patient_id, findingId: finding.finding_id },
				})
			}
		/>
	)
}
