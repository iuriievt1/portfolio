import type { BufferedFile } from "@ansora/core-mobile"
import type { ImageResizeMode } from "react-native"
import { ThumbnailImage } from "../../../ui/ThumbnailImage"
import { useThumbnail } from "../../capture/thumbnails"

interface Props {
	page: BufferedFile
	className: string
	resizeMode?: ImageResizeMode
}

// ADR-026, CAP-009-R17
export function PageImage({ page, className, resizeMode }: Props) {
	const uri = useThumbnail(page)
	return <ThumbnailImage uri={uri} className={className} placeholderClassName="bg-card" resizeMode={resizeMode} />
}
