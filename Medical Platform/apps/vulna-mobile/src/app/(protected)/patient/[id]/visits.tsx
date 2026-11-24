import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Encounter } from "../../../../api/encounters"
import type { Patient } from "../../../../api/patients"
import { VisitsScreen } from "../../../../features/history/components/VisitsScreen"
import { usePatientVisits } from "../../../../features/history/hooks/use-patient-visits"
import { openedPatient } from "../../../../features/patient/opened-patient"
import { openVisit } from "../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../navigation/routes"

// CAP-014-R24, E109
export default function PatientVisitsRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <PatientVisits patient={patient} />
}

function PatientVisits({ patient }: { patient: Patient }) {
	const router = useRouter()
	const { state, retry, loadMore } = usePatientVisits(patient.patient_id)

	// CAP-014-R21, CAP-014-R24, CAP-014-R30, E105, E120
	const open = (visit: Encounter) => {
		if (visit.status === ENCOUNTER_STATUS.COMPLETED) {
			router.push({
				pathname: ROUTE.PATIENT_COMPLETED_VISIT,
				params: { id: patient.patient_id, encounterId: visit.encounter_id },
			})
			return
		}
		const id = openVisit({ patient, encounterId: visit.encounter_id, encounterKey: undefined, openedAt: new Date() })
		router.push({ pathname: ROUTE.VISIT, params: { id } })
	}

	return (
		<VisitsScreen
			patient={patient}
			state={state}
			onBack={() => router.back()}
			onRetry={retry}
			onMore={() => void loadMore()}
			onOpen={open}
		/>
	)
}
