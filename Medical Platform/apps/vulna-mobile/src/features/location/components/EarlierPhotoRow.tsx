import { useTexts } from "../../../i18n/language-store"
import { ThumbnailRow } from "../../capture/components/ThumbnailRow"
import type { EarlierPhoto } from "../earlier-photos"
import { EarlierThumbnail } from "./EarlierThumbnail"

interface Props {
	photos: readonly EarlierPhoto[]
	selectedId?: string
	isInset?: boolean
	onSelect: (imageId: string) => void
}

// CAP-016-R17, CAP-015-R32, Figma 05 B, Figma 05 F
export function EarlierPhotoRow({ photos, selectedId, isInset, onSelect }: Props) {
	const texts = useTexts()
	const items = photos.map((photo) => ({
		key: photo.imageId,
		thumbnail: (className: string) => <EarlierThumbnail imageId={photo.imageId} className={className} />,
	}))
	return (
		<ThumbnailRow
			items={items}
			selectedKey={selectedId}
			isInset={isInset}
			label={texts.capture.location.earlierPhotos}
			onSelect={onSelect}
		/>
	)
}
