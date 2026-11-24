import { Redirect, useRouter } from "expo-router"
import type { Patient } from "../../api/patients"
import { PatientChoiceSheet } from "../../features/identification/components/PatientChoiceSheet"
import { useOfferedMatches } from "../../features/identification/hooks/use-offered-matches"
import { openPatient } from "../../features/patient/opened-patient"
import { ROUTE } from "../../navigation/routes"

// CAP-013-R10, CAP-013-S19
export default function PatientChoice() {
	const router = useRouter()
	const matches = useOfferedMatches()

	if (matches === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}

	const choose = (patient: Patient) => {
		openPatient(patient)
		router.replace({ pathname: ROUTE.PATIENT, params: { id: patient.patient_id } })
	}

	return <PatientChoiceSheet matches={matches} onPatient={choose} onClose={() => router.back()} />
}
