import { Redirect, useLocalSearchParams } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { stepAfterLocation } from "../../../../../features/assessment/clinical-steps"
import { clinicalSteps } from "../../../../../features/assessment/instance-clinical-steps"
import { chooseWound, WOUND_CHOICE, type WoundChoice } from "../../../../../features/capture/capture-session"
import { DraftStepDialogs } from "../../../../../features/capture/components/DraftStepDialogs"
import { type CaptureOrigin, useCaptureFlow } from "../../../../../features/capture/hooks/use-capture-flow"
import { useDraftStepSave } from "../../../../../features/capture/hooks/use-draft-step-save"
import { LocationScreen } from "../../../../../features/location/components/LocationScreen"
import { useLocationData } from "../../../../../features/location/hooks/use-location-data"
import { locationUpdateOf } from "../../../../../features/location/location-update"
import { LOAD_STATE } from "../../../../../features/remote/hooks/use-remote-content"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { useTexts } from "../../../../../i18n/language-store"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	origin: CaptureOrigin | undefined
	patient: Patient
}

// CAP-015-R31, CAP-016-R17, CAP-017-R16
export default function LocationRoute() {
	const { id, acquisitionId, origin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: CaptureOrigin
	}>()
	const visit = openedVisit(id)
	if (visit === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <Location visitId={id} acquisitionId={acquisitionId} origin={origin} patient={visit.patient} />
}

function Location({ visitId, acquisitionId, origin, patient }: Props) {
	const texts = useTexts()
	const { state, retry } = useLocationData(patient.patient_id, acquisitionId)
	const flow = useCaptureFlow(visitId, acquisitionId)
	const saving = useDraftStepSave(acquisitionId)

	// CAP-016-S01, CAP-016-S10, CAP-015-R30
	const proceed = async (chosen: WoundChoice) => {
		if (state.kind !== LOAD_STATE.READY) {
			return
		}
		const saved = await saving.save((draft) => locationUpdateOf(chosen, draft, state.wounds))
		if (!saved) {
			return
		}
		chooseWound(acquisitionId, chosen)
		flow.next(stepAfterLocation(chosen.kind === WOUND_CHOICE.NEW, clinicalSteps()), origin)
	}

	return (
		<>
			<LocationScreen
				acquisitionId={acquisitionId}
				patient={patient}
				data={state}
				isSaving={saving.isSaving}
				onRetry={retry}
				onBack={flow.back}
				onContinue={(chosen) => void proceed(chosen)}
				onOpenEarlier={flow.earlierPhoto}
			/>
			<DraftStepDialogs
				failure={saving.failure}
				serverErrorHeading={texts.capture.location.saveFailed}
				onDismiss={saving.dismiss}
				onReload={() => saving.dismissAnd(retry)}
			/>
		</>
	)
}
