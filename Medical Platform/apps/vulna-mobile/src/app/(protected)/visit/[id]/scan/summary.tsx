import { ACQUISITION_KIND } from "@ansora/contracts"
import { Redirect, useLocalSearchParams } from "expo-router"
import { CaptureFailureDialog } from "../../../../../features/capture/components/CaptureFailureDialog"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import type { PhotoOwner } from "../../../../../features/capture/photo-buffer"
import { ScanSummaryScreen } from "../../../../../features/scan/components/ScanSummaryScreen"
import { usePageOrder } from "../../../../../features/scan/hooks/use-page-order"
import { SCAN_ORIGIN, useScanFlow } from "../../../../../features/scan/hooks/use-scan-flow"
import { useClosingExit } from "../../../../../features/session/hooks/use-closing-exit"
import { ClosingDialogs } from "../../../../../features/summary/components/ClosingDialogs"
import { OpenedServerFile } from "../../../../../features/summary/components/ServerFileDialog"
import { useServerFiles } from "../../../../../features/summary/hooks/use-server-files"
import { useSummaryClosing } from "../../../../../features/summary/hooks/use-summary-closing"
import { REVIEW_OPENER } from "../../../../../features/summary/review-opening"
import type { RecordFile } from "../../../../../features/summary/shown-file"
import { type OpenedVisit, openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	owner: PhotoOwner
	visit: OpenedVisit
}

// CAP-018-R11, CAP-018-R14, CAP-014-R14, Figma 06 A.4, B.1, G.1
export default function ScanSummaryRoute() {
	const { id, acquisitionId } = useLocalSearchParams<{ id: string; acquisitionId: string }>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return <ScanSummary visitId={id} owner={owner} visit={visit} />
}

function ScanSummary({ visitId, owner, visit }: Props) {
	const { acquisitionId } = owner
	const flow = useScanFlow(visitId, acquisitionId)
	const order = usePageOrder(owner)
	const exit = useClosingExit(acquisitionId, flow.close)
	const summary = useSummaryClosing({ kind: ACQUISITION_KIND.SCAN, acquisitionId, onClosed: exit })
	const serverFiles = useServerFiles(acquisitionId, flow.retakeFromSummary)

	// CAP-018-R14, CAP-015-R36, Q-076
	const openPage = (page: RecordFile) =>
		serverFiles.open(page, (fileKey) => flow.page(fileKey, { opener: REVIEW_OPENER.SUMMARY, cameraOrigin: undefined }))

	return (
		<>
			<ScanSummaryScreen
				patient={visit.patient}
				openedAt={visit.openedAt}
				session={summary.session}
				files={summary.files}
				data={summary.data}
				closing={summary.closing}
				onRetry={summary.retry}
				onBack={flow.back}
				onOpenTitle={() => flow.title(SCAN_ORIGIN.SUMMARY)}
				onOpenPage={openPage}
				onAddPage={flow.addPage}
				onReorder={order.reorder}
			/>
			<ClosingDialogs {...summary.dialogs} onLater={flow.close} />
			<OpenedServerFile kind={ACQUISITION_KIND.SCAN} files={serverFiles} />
			<CaptureFailureDialog
				failure={order.failure ?? serverFiles.failure}
				onDismiss={() => {
					order.dismissFailure()
					serverFiles.dismissFailure()
				}}
			/>
		</>
	)
}
