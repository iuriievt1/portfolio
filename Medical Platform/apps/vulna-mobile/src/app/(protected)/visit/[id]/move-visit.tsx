import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import { useCallback } from "react"
import type { AcquisitionDraft } from "../../../../api/acquisitions"
import type { Patient } from "../../../../api/patients"
import { useTodayVisits } from "../../../../features/patient/hooks/use-today-visits"
import { MoveDialogs } from "../../../../features/visit/components/MoveDialogs"
import { MoveVisitScreen } from "../../../../features/visit/components/MoveVisitScreen"
import { MOVE, useRecordMove } from "../../../../features/visit/hooks/use-record-move"
import { openVisit } from "../../../../features/visit/opened-visit"
import { forgetRecordMove, type RecordMove, recordMove } from "../../../../features/visit/record-move"
import { MOVE_TARGET } from "../../../../features/visit/record-move-text"
import { ROUTE } from "../../../../navigation/routes"

// CAP-014-R07, CAP-014-R25, CAP-014-S04, E117
export default function MoveVisitRoute() {
	const { id } = useLocalSearchParams<{ id: string }>()
	const move = recordMove()
	const patient = move?.target
	if (move === undefined || patient === undefined) {
		return <Redirect href={{ pathname: ROUTE.VISIT, params: { id } }} />
	}
	return <MoveVisit routeId={id} move={move} patient={patient} />
}

function MoveVisit({ routeId, move, patient }: { routeId: string; move: RecordMove; patient: Patient }) {
	const router = useRouter()
	const visits = useTodayVisits(patient.patient_id)

	// CAP-014-R25
	const showTarget = useCallback(
		(moved: AcquisitionDraft) => {
			forgetRecordMove()
			const encounterId = moved.encounter?.encounter_id
			if (encounterId === undefined) {
				router.dismissTo({ pathname: ROUTE.VISIT, params: { id: routeId } })
				return
			}
			const id = openVisit({ patient, encounterId, encounterKey: undefined, openedAt: new Date() })
			router.replace({ pathname: ROUTE.VISIT, params: { id } })
		},
		[router, routeId, patient],
	)

	const moving = useRecordMove(move, patient, showTarget)

	// CAP-013-R08
	const leave = useCallback(() => {
		moving.dismiss()
		forgetRecordMove()
		router.dismissTo({ pathname: ROUTE.VISIT, params: { id: routeId } })
	}, [moving, router, routeId])

	const chooseAgain = useCallback(() => {
		moving.dismiss()
		visits.retry()
	}, [moving, visits])

	const step = moving.step
	return (
		<>
			<MoveVisitScreen
				patient={patient}
				visits={visits.state}
				sourceEncounterId={move.source.encounterId}
				isMovingToNewVisit={step.kind === MOVE.MOVING && step.target.kind === MOVE_TARGET.NEW}
				onBack={() => router.back()}
				onRetry={visits.retry}
				onVisit={moving.chooseVisit}
				onNewVisit={() =>
					void moving
						.chooseNewVisit()
						.catch((failure: unknown) => console.warn("a new visit could not be chosen", failure))
				}
			/>
			<MoveDialogs
				step={step}
				move={move}
				patient={patient}
				onConfirm={() => void moving.confirm()}
				onDismiss={moving.dismiss}
				onChooseVisit={chooseAgain}
				onLeave={leave}
			/>
		</>
	)
}
