import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../api/patients"
import { PatientChoiceSheet } from "../../../../features/identification/components/PatientChoiceSheet"
import { useOfferedMatches } from "../../../../features/identification/hooks/use-offered-matches"
import { chooseMoveTarget } from "../../../../features/visit/record-move"
import { ROUTE } from "../../../../navigation/routes"

// CAP-014-R25, CAP-013-R10, CAP-013-S19, E116
export default function MoveChoice() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const router = useRouter()
	const matches = useOfferedMatches()

	if (matches === undefined) {
		return <Redirect href={{ pathname: ROUTE.VISIT, params: { id } }} />
	}

	const choose = (patient: Patient) => {
		chooseMoveTarget(patient)
		router.replace({ pathname: ROUTE.MOVE_VISIT, params: { id } })
	}

	return <PatientChoiceSheet matches={matches} onPatient={choose} onClose={() => router.back()} />
}
