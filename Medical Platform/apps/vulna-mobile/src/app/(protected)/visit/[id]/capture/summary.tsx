import { ACQUISITION_KIND } from "@ansora/contracts"
import { Redirect, useLocalSearchParams } from "expo-router"
import { CAPTURE_STEP, stepAfterLocation } from "../../../../../features/assessment/clinical-steps"
import { clinicalSteps } from "../../../../../features/assessment/instance-clinical-steps"
import { WOUND_CHOICE } from "../../../../../features/capture/capture-session"
import { CaptureFailureDialog } from "../../../../../features/capture/components/CaptureFailureDialog"
import { CAPTURE_ORIGIN, useCaptureFlow } from "../../../../../features/capture/hooks/use-capture-flow"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { useClosingExit } from "../../../../../features/session/hooks/use-closing-exit"
import { ClosingDialogs } from "../../../../../features/summary/components/ClosingDialogs"
import { OpenedServerFile } from "../../../../../features/summary/components/ServerFileDialog"
import { SummaryScreen } from "../../../../../features/summary/components/SummaryScreen"
import { useServerFiles } from "../../../../../features/summary/hooks/use-server-files"
import { useSummaryClosing } from "../../../../../features/summary/hooks/use-summary-closing"
import { REVIEW_OPENER } from "../../../../../features/summary/review-opening"
import type { RecordFile } from "../../../../../features/summary/shown-file"
import { WOUND_STEP, type WoundStep } from "../../../../../features/summary/wound-step"
import { type OpenedVisit, openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	visit: OpenedVisit
}

// CAP-015-R31, CAP-014-R14
export default function SummaryRoute() {
	const { id, acquisitionId } = useLocalSearchParams<{ id: string; acquisitionId: string }>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <Summary visitId={id} acquisitionId={acquisitionId} visit={visit} />
}

function Summary({ visitId, acquisitionId, visit }: Props) {
	const flow = useCaptureFlow(visitId, acquisitionId)
	const exit = useClosingExit(acquisitionId, flow.close)
	const summary = useSummaryClosing({ kind: ACQUISITION_KIND.PHOTO, acquisitionId, onClosed: exit })
	const serverFiles = useServerFiles(acquisitionId, flow.retakeFromSummary)

	// CAP-017-R19, CAP-017-R16, Figma 05 C
	const assessmentStep = stepAfterLocation(summary.session.wound?.kind !== WOUND_CHOICE.EXISTING, clinicalSteps())
	const openAssessment =
		assessmentStep === CAPTURE_STEP.SUMMARY ? undefined : () => flow.next(assessmentStep, CAPTURE_ORIGIN.SUMMARY)

	// CAP-015-R35, CAP-015-R36, Q-076
	const openPhoto = (file: RecordFile) =>
		serverFiles.open(file, (fileKey) =>
			flow.review(fileKey, { opener: REVIEW_OPENER.SUMMARY, cameraOrigin: undefined }),
		)

	// E107
	const fillStep = (step: WoundStep) => {
		summary.dialogs.onDismiss()
		if (step === WOUND_STEP.LOCATION) {
			flow.location(CAPTURE_ORIGIN.SUMMARY)
			return
		}
		openAssessment?.()
	}

	return (
		<>
			<SummaryScreen
				patient={visit.patient}
				openedAt={visit.openedAt}
				session={summary.session}
				files={summary.files}
				data={summary.data}
				onRetry={summary.retry}
				onBack={flow.back}
				onOpenPhoto={openPhoto}
				onAddPhoto={flow.addPhoto}
				onOpenAssessment={openAssessment}
				onOpenNote={flow.note}
				closing={summary.closing}
			/>
			<ClosingDialogs {...summary.dialogs} onLater={flow.close} onFillStep={fillStep} />
			<OpenedServerFile kind={ACQUISITION_KIND.PHOTO} files={serverFiles} />
			<CaptureFailureDialog failure={serverFiles.failure} onDismiss={serverFiles.dismissFailure} />
		</>
	)
}
