import { Redirect, useLocalSearchParams } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { DraftStepDialogs } from "../../../../../features/capture/components/DraftStepDialogs"
import { useDraftStepSave } from "../../../../../features/capture/hooks/use-draft-step-save"
import { LOAD_STATE } from "../../../../../features/remote/hooks/use-remote-content"
import { DocumentTitleScreen } from "../../../../../features/scan/components/DocumentTitleScreen"
import { titleCodeUpdateOf } from "../../../../../features/scan/document-title"
import { useDocumentTitles } from "../../../../../features/scan/hooks/use-document-titles"
import { useKnownDraft } from "../../../../../features/scan/hooks/use-known-draft"
import { SCAN_ORIGIN, type ScanOrigin, useScanFlow } from "../../../../../features/scan/hooks/use-scan-flow"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { useTexts } from "../../../../../i18n/language-store"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	origin: ScanOrigin | undefined
	patient: Patient
}

// CAP-018-R15, CAP-017-R19, Figma 06 A.3, B.5
export default function DocumentTitleRoute() {
	const { id, acquisitionId, origin } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		origin?: ScanOrigin
	}>()
	const visit = openedVisit(id)
	if (visit === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <DocumentTitle visitId={id} acquisitionId={acquisitionId} origin={origin} patient={visit.patient} />
}

function DocumentTitle({ visitId, acquisitionId, origin, patient }: Props) {
	const texts = useTexts()
	const { draft } = useCaptureSession(acquisitionId)
	const { state, retry } = useDocumentTitles()
	const flow = useScanFlow(visitId, acquisitionId)
	const saving = useDraftStepSave(acquisitionId)
	useKnownDraft(acquisitionId)
	const title = draft?.document_title

	// CAP-018-R15, CAP-015-R30
	const select = async (code: string) => {
		if (state.kind !== LOAD_STATE.READY) {
			return
		}
		const saved = await saving.save((current) => titleCodeUpdateOf(current, code, state.version))
		if (saved) {
			flow.afterTitle(origin)
		}
	}

	const reload = () => {
		saving.reload()
		retry()
	}

	const isReturning = origin === SCAN_ORIGIN.SUMMARY && title !== undefined

	return (
		<>
			<DocumentTitleScreen
				patient={patient}
				choices={state}
				selectedCode={title?.code}
				hasCustomTitle={title?.text !== undefined}
				isSaving={saving.isSaving}
				onRetry={retry}
				onBack={flow.back}
				onSelect={(code) => void select(code)}
				onCustom={() => flow.customTitle(origin)}
				onContinue={isReturning ? () => flow.afterTitle(origin) : undefined}
			/>
			<DraftStepDialogs
				failure={saving.failure}
				serverErrorHeading={texts.scan.documentTitle.saveFailed}
				onDismiss={() => saving.dismissAnd(retry)}
				onReload={reload}
			/>
		</>
	)
}
