import type { BufferedFile, PageCorners } from "@ansora/core-mobile"
import { Redirect, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import type { Patient } from "../../../../../api/patients"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { CaptureFailureDialog } from "../../../../../features/capture/components/CaptureFailureDialog"
import { useHoldScreen } from "../../../../../features/capture/hooks/use-hold-screen"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { PageCropScreen } from "../../../../../features/scan/components/PageCropScreen"
import { useOriginalImage } from "../../../../../features/scan/hooks/use-original-image"
import { usePageCrop } from "../../../../../features/scan/hooks/use-page-crop"
import { useScanFlow } from "../../../../../features/scan/hooks/use-scan-flow"
import { cornersOf } from "../../../../../features/scan/scanned-page"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	page: BufferedFile
	patient: Patient
}

// CAP-018-R10, CAP-018-R11, Figma 06 B.3
export default function PageCropRoute() {
	const { id, acquisitionId, fileKey } = useLocalSearchParams<{ id: string; acquisitionId: string; fileKey: string }>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	const { photos: pages } = useCaptureSession(acquisitionId)
	const page = pages.find((candidate) => candidate.fileKey === fileKey)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	if (page === undefined) {
		return null
	}
	return <PageCrop visitId={id} acquisitionId={acquisitionId} page={page} patient={visit.patient} />
}

function PageCrop({ visitId, acquisitionId, page, patient }: Props) {
	const flow = useScanFlow(visitId, acquisitionId)
	const crop = usePageCrop(acquisitionId)
	const imageUri = useOriginalImage(page)
	const [isCropped, setCropped] = useState(false)
	useHoldScreen(crop.isBusy)

	useEffect(() => {
		if (isCropped && !crop.isBusy) {
			flow.back()
		}
	}, [isCropped, crop.isBusy, flow])

	const apply = async (corners: PageCorners) => {
		if (await crop.recrop(page, corners)) {
			setCropped(true)
		}
	}

	return (
		<>
			<PageCropScreen
				patient={patient}
				imageUri={imageUri}
				detected={cornersOf(page)}
				isBusy={crop.isBusy}
				onBack={flow.back}
				onApply={(corners) => void apply(corners)}
			/>
			<CaptureFailureDialog failure={crop.failure} onDismiss={crop.dismissFailure} />
		</>
	)
}
