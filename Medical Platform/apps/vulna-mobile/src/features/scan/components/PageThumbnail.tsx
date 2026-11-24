import type { BufferedFile } from "@ansora/core-mobile"
import { View } from "react-native"
import { ThumbnailImage, WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { useThumbnail } from "../../capture/thumbnails"

interface Props {
	page: BufferedFile | undefined
	previewUri: string | undefined
	className: string
}

// ADR-026, CAP-018-R02, Vulna / Capture / Series tile
export function PageThumbnail({ page, previewUri, className }: Props) {
	const uri = useThumbnail(page) ?? previewUri
	return (
		<View className={`items-center justify-center overflow-hidden bg-capture-tile ${className}`}>
			<ThumbnailImage uri={uri} className="h-full w-full" placeholderClassName="" resizeMode={WHOLE_PHOTO} />
		</View>
	)
}
