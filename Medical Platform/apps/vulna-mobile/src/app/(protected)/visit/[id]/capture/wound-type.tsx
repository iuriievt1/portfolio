import { Redirect, useLocalSearchParams } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { woundTypeUpdateOf } from "../../../../../features/assessment/assessment-update"
import { stepAfterWoundType } from "../../../../../features/assessment/clinical-steps"
import { ChoiceListScreen } from "../../../../../features/assessment/components/ChoiceListScreen"
import { useWoundTypes } from "../../../../../features/assessment/hooks/use-code-list-items"
import { clinicalSteps } from "../../../../../features/assessment/instance-clinical-steps"
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

// CAP-015-R31, CAP-017-R02, CAP-017-R19, CAP-017-R16, Figma 05 A.5
export default function WoundTypeRoute() {
	const { id, acquisitionId, origin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: CaptureOrigin
	}>()
	const visit = openedVisit(id)
	if (visit === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <WoundType visitId={id} acquisitionId={acquisitionId} origin={origin} patient={visit.patient} />
}

function WoundType({ visitId, acquisitionId, origin, patient }: Props) {
	const texts = useTexts()
	const { draft } = useCaptureSession(acquisitionId)
	const { state, retry } = useWoundTypes()
	const flow = useCaptureFlow(visitId, acquisitionId)
	const saving = useDraftStepSave(acquisitionId)

	// CAP-017-S12, CAP-017-S13, CAP-015-R30
	const select = async (code: string) => {
		if (state.kind !== LOAD_STATE.READY) {
			return
		}
		const saved = await saving.save((current) => woundTypeUpdateOf(current, code, state.version))
		if (saved) {
			flow.next(stepAfterWoundType(clinicalSteps()), origin)
		}
	}

	const reload = () => {
		saving.reload()
		retry()
	}

	return (
		<>
			<ChoiceListScreen
				title={texts.capture.woundType.title}
				patient={patient}
				choices={state}
				selectedCode={draft?.wound_type_code ?? undefined}
				badge={undefined}
				isSaving={saving.isSaving}
				onRetry={retry}
				onBack={flow.back}
				onSelect={(code) => void select(code)}
			/>
			<DraftStepDialogs
				failure={saving.failure}
				serverErrorHeading={texts.capture.woundType.saveFailed}
				onDismiss={() => saving.dismissAnd(retry)}
				onReload={reload}
			/>
		</>
	)
}
