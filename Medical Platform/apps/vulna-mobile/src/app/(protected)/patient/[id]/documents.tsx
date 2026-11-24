import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../api/patients"
import { DocumentsScreen } from "../../../../features/documents/components/DocumentsScreen"
import { usePatientDocuments } from "../../../../features/documents/hooks/use-patient-documents"
import { openedPatient } from "../../../../features/patient/opened-patient"
import { ROUTE } from "../../../../navigation/routes"

// CAP-020-R18, E110
export default function PatientDocumentsRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const patient = openedPatient(id)
	if (patient === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <PatientDocuments patient={patient} />
}

function PatientDocuments({ patient }: { patient: Patient }) {
	const router = useRouter()
	const { state, retry, loadMore } = usePatientDocuments(patient.patient_id)
	return (
		<DocumentsScreen
			patient={patient}
			state={state}
			onBack={() => router.back()}
			onRetry={retry}
			onMore={() => void loadMore()}
			onOpen={(document) => router.push({ pathname: ROUTE.RECORD_DETAIL, params: { id: document.acquisition_id } })}
		/>
	)
}
