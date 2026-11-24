import type { BufferedFile, PhotoCrop } from "@ansora/core-mobile"
import { Redirect, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { useCaptureSession } from "../../../../../features/capture/capture-session"
import { CaptureFailureDialog } from "../../../../../features/capture/components/CaptureFailureDialog"
import { CropScreen } from "../../../../../features/capture/components/CropScreen"
import { useCaptureFlow } from "../../../../../features/capture/hooks/use-capture-flow"
import { useHoldScreen } from "../../../../../features/capture/hooks/use-hold-screen"
import { usePhotoEdits } from "../../../../../features/capture/hooks/use-photo-edits"
import { usePhotoOwner } from "../../../../../features/capture/hooks/use-photo-owner"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	photo: BufferedFile
}

// CAP-015-R34
export default function CropRoute() {
	const { id, acquisitionId, fileKey } = useLocalSearchParams<{ id: string; acquisitionId: string; fileKey: string }>()
	const visit = openedVisit(id)
	const owner = usePhotoOwner(acquisitionId)
	const { photos } = useCaptureSession(acquisitionId)
	const photo = photos.find((candidate) => candidate.fileKey === fileKey)
	if (visit === undefined || owner === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	if (photo === undefined) {
		return null
	}
	return <Crop visitId={id} acquisitionId={acquisitionId} photo={photo} />
}

function Crop({ visitId, acquisitionId, photo }: Props) {
	const flow = useCaptureFlow(visitId, acquisitionId)
	const edits = usePhotoEdits(acquisitionId)
	const [isCropped, setCropped] = useState(false)
	useHoldScreen(edits.isBusy)

	useEffect(() => {
		if (isCropped && !edits.isBusy) {
			flow.back()
		}
	}, [isCropped, edits.isBusy, flow])

	const done = async (rectangle: PhotoCrop) => {
		if (await edits.crop(photo, rectangle)) {
			setCropped(true)
		}
	}

	return (
		<>
			<CropScreen
				photo={photo}
				isBusy={edits.isBusy}
				onCancel={flow.back}
				onDone={(rectangle) => void done(rectangle)}
			/>
			<CaptureFailureDialog failure={edits.failure} onDismiss={edits.dismissFailure} />
		</>
	)
}
