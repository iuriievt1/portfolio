import type { BufferedFile } from "@ansora/core-mobile"
import type { ImageResizeMode } from "react-native"
import { ThumbnailImage } from "../../../ui/ThumbnailImage"
import { useThumbnail } from "../thumbnails"

interface Props {
	photo: BufferedFile | undefined
	previewUri?: string
	className: string
	resizeMode?: ImageResizeMode
}

// ADR-026, CAP-009-R17, CAP-015-R10
export function PhotoThumbnail({ photo, previewUri, className, resizeMode }: Props) {
	const uri = useThumbnail(photo) ?? previewUri
	return (
		<ThumbnailImage uri={uri} className={className} placeholderClassName="bg-capture-control" resizeMode={resizeMode} />
	)
}
