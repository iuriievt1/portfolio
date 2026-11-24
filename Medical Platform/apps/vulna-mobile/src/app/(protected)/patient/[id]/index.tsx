import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../api/patients"
import { PatientDetailScreen } from "../../../../features/patient/components/PatientDetailScreen"
import { useTodayVisits } from "../../../../features/patient/hooks/use-today-visits"
import { openedPatient } from "../../../../features/patient/opened-patient"
import { openNewVisit } from "../../../../features/visit/new-visit"
import { openVisit } from "../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../navigation/routes"

// CAP-013-R19, CAP-014-R19
export default function PatientRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <PatientDetail patient={patient} />
}

function PatientDetail({ patient }: { patient: Patient }) {
	const router = useRouter()
	const today = useTodayVisits(patient.patient_id)
	const params = { id: patient.patient_id }

	const showVisit = (id: string) => router.push({ pathname: ROUTE.VISIT, params: { id } })

	// CAP-014-R05, CAP-014-R06
	const showNewVisit = async () => showVisit(await openNewVisit(patient))

	return (
		<PatientDetailScreen
			patient={patient}
			today={today.state}
			documentation={{
				onVisits: () => router.push({ pathname: ROUTE.PATIENT_VISITS, params }),
				onWounds: () => router.push({ pathname: ROUTE.PATIENT_WOUNDS, params }),
				onDocuments: () => router.push({ pathname: ROUTE.PATIENT_DOCUMENTS, params }),
			}}
			onBack={() => router.back()}
			onRetry={today.retry}
			onOpenVisit={(visit) =>
				showVisit(
					openVisit({ patient, encounterId: visit.encounter_id, encounterKey: undefined, openedAt: new Date() }),
				)
			}
			onNewVisit={() =>
				void showNewVisit().catch((failure: unknown) => console.warn("a new visit could not be opened", failure))
			}
		/>
	)
}
