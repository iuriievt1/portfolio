import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback } from "react"
import type { Patient } from "../../../../api/patients"
import { IdentificationDialogs } from "../../../../features/identification/components/IdentificationDialogs"
import { type MatchingPatients, offerMatchingPatients } from "../../../../features/identification/matching-patients"
import { usePatientFinder } from "../../../../features/overview/hooks/use-patient-finder"
import { MovePatientScreen } from "../../../../features/visit/components/MovePatientScreen"
import { chooseMoveTarget, forgetRecordMove, type RecordMove, recordMove } from "../../../../features/visit/record-move"
import { ROUTE } from "../../../../navigation/routes"

// CAP-014-R25, CAP-013-R10, E117
export default function MovePatientRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const move = recordMove()
	if (move === undefined) {
		return <Redirect href={{ pathname: ROUTE.VISIT, params: { id } }} />
	}
	return <MovePatient routeId={id} move={move} />
}

function MovePatient({ routeId, move }: { routeId: string; move: RecordMove }) {
	const router = useRouter()

	const choose = useCallback(
		(patient: Patient) => {
			chooseMoveTarget(patient)
			router.push({ pathname: ROUTE.MOVE_VISIT, params: { id: routeId } })
		},
		[router, routeId],
	)

	const offerMatches = useCallback(
		(matches: MatchingPatients) => {
			offerMatchingPatients(matches)
			router.push({ pathname: ROUTE.MOVE_CHOICE, params: { id: routeId } })
		},
		[router, routeId],
	)

	const finder = usePatientFinder({ onPatient: choose, onMatches: offerMatches })

	// CAP-013-R08
	const leave = () => {
		forgetRecordMove()
		router.back()
	}

	return (
		<>
			<MovePatientScreen patient={move.draft.patient} identification={finder.identification} onBack={leave} />
			<IdentificationDialogs flow={finder.flow} />
		</>
	)
}
