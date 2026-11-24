import type { ImageResizeMode } from "react-native"
import { ThumbnailImage } from "../../../ui/ThumbnailImage"
import { useEarlierThumbnail } from "../hooks/use-earlier-photos"

interface Props {
	imageId: string
	className: string
	resizeMode?: ImageResizeMode
}

// ADR-026, CAP-009-R11
export function EarlierThumbnail({ imageId, className, resizeMode }: Props) {
	const uri = useEarlierThumbnail(imageId)
	return <ThumbnailImage uri={uri} className={className} placeholderClassName="bg-secondary" resizeMode={resizeMode} />
}
