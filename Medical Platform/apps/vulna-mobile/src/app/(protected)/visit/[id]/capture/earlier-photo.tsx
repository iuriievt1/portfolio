import { Redirect, useLocalSearchParams, useRouter } from "expo-router"
import type { Patient } from "../../../../../api/patients"
import { useCaptureFlow } from "../../../../../features/capture/hooks/use-capture-flow"
import { knownRegions } from "../../../../../features/code-lists/code-list-store"
import { EarlierPhotoScreen } from "../../../../../features/location/components/EarlierPhotoScreen"
import { useLoadedEarlierPhotos } from "../../../../../features/location/hooks/use-earlier-photos"
import { openedVisit } from "../../../../../features/visit/opened-visit"
import { ROUTE } from "../../../../../navigation/routes"

interface Props {
	visitId: string
	acquisitionId: string
	findingId: string
	imageId: string
	patient: Patient
}

// CAP-016-R17, CAP-015-R32
export default function EarlierPhotoRoute() {
	const { id, acquisitionId, findingId, imageId } = useLocalSearchParams<{
		id: string
		acquisitionId: string
		findingId: string
		imageId: string
	}>()
	const visit = openedVisit(id)
	if (visit === undefined) {
		return <Redirect href={ROUTE.HOME} />
	}
	return (
		<EarlierPhoto
			visitId={id}
			acquisitionId={acquisitionId}
			findingId={findingId}
			imageId={imageId}
			patient={visit.patient}
		/>
	)
}

function EarlierPhoto({ visitId, acquisitionId, findingId, imageId, patient }: Props) {
	const router = useRouter()
	const photos = useLoadedEarlierPhotos(findingId)
	const flow = useCaptureFlow(visitId, acquisitionId)
	const selected = photos.find((photo) => photo.imageId === imageId) ?? photos[0]
	if (selected === undefined) {
		return null
	}
	return (
		<EarlierPhotoScreen
			photos={photos}
			selected={selected}
			regions={knownRegions()}
			patient={patient}
			onSelect={(nextId) => router.setParams({ imageId: nextId })}
			onClose={flow.back}
		/>
	)
}
