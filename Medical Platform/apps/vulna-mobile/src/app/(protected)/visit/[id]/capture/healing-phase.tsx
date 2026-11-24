import { Redirect, useLocalSearchParams } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { healingPhaseUpdateOf } from "../../../../../features/assessment/assessment-update"
import { CAPTURE_STEP } from "../../../../../features/assessment/clinical-steps"
import { ChoiceListScreen } from "../../../../../features/assessment/components/ChoiceListScreen"
import { useHealingPhases } from "../../../../../features/assessment/hooks/use-code-list-items"
import { lastPhaseOf } from "../../../../../features/assessment/last-phase"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { DraftStepDialogs } from "../../../../../features/capture/components/DraftStepDialogs"
import { type CaptureOrigin, useCaptureFlow } from "../../../../../features/capture/hooks/use-capture-flow"
import { useDraftStepSave } from "../../../../../features/capture/hooks/use-draft-step-save"
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

// CAP-015-R31, CAP-017-R03, CAP-017-R19, Figma 05 A.6
export default function HealingPhaseRoute() {
	const { id, acquisitionId, origin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: CaptureOrigin
	}>()
	const visit = openedVisit(id)
	if (visit === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <HealingPhase visitId={id} acquisitionId={acquisitionId} origin={origin} patient={visit.patient} />
}

function HealingPhase({ visitId, acquisitionId, origin, patient }: Props) {
	const texts = useTexts()
	const session = useCaptureSession(acquisitionId)
	const { state, retry } = useHealingPhases()
	const flow = useCaptureFlow(visitId, acquisitionId)
	const saving = useDraftStepSave(acquisitionId)

	// CAP-017-S12, CAP-015-R30
	const select = async (code: string) => {
		if (state.kind !== LOAD_STATE.READY) {
			return
		}
		const saved = await saving.save((current) => healingPhaseUpdateOf(current, code, state.version))
		if (saved) {
			flow.next(CAPTURE_STEP.SUMMARY, origin)
		}
	}

	const reload = () => {
		saving.reload()
		retry()
	}

	return (
		<>
			<ChoiceListScreen
				title={texts.capture.healingPhase.title}
				patient={patient}
				choices={state}
				selectedCode={session.draft?.assessment?.healing_phase_code}
				badge={lastPhaseOf(session, texts)}
				isSaving={saving.isSaving}
				onRetry={retry}
				onBack={flow.back}
				onSelect={(code) => void select(code)}
			/>
			<DraftStepDialogs
				failure={saving.failure}
				serverErrorHeading={texts.capture.healingPhase.saveFailed}
				onDismiss={() => saving.dismissAnd(retry)}
				onReload={reload}
			/>
		</>
	)
}
