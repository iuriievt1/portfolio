import { type ImageResizeMode, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { ThumbnailImage } from "../../../ui/ThumbnailImage"
import { Caption, TEXT_TONE } from "../../../ui/typography"
import { useImageThumbnail, usePageThumbnail } from "../hooks/use-remote-thumbnail"
import { THUMBNAIL, type ThumbnailState } from "../image-state"

const REASON_LINES = 3

interface ViewProps {
	className: string
	placeholderClassName: string
	resizeMode?: ImageResizeMode
	showsReason?: boolean
}

// ADR-026, CAP-020-R22, E125
export function RemoteThumbnail({
	state,
	className,
	placeholderClassName,
	resizeMode,
	showsReason = true,
}: ViewProps & { state: ThumbnailState }) {
	const texts = useTexts().record.viewer.unavailable
	if (state.kind === THUMBNAIL.SHOWN) {
		return (
			<ThumbnailImage
				uri={state.uri}
				className={className}
				placeholderClassName={placeholderClassName}
				resizeMode={resizeMode}
			/>
		)
	}
	if (state.kind === THUMBNAIL.UNAVAILABLE && showsReason) {
		return (
			<View className={`${className} ${placeholderClassName} items-center justify-center p-1.5`}>
				<Caption className="self-stretch text-center" tone={TEXT_TONE.MUTED} numberOfLines={REASON_LINES}>
					{texts.label}
				</Caption>
			</View>
		)
	}
	return <View className={`${className} ${placeholderClassName}`} />
}

// ADR-026
export function ImageThumbnail({ imageId, ...view }: ViewProps & { imageId: string }) {
	return <RemoteThumbnail state={useImageThumbnail(imageId)} {...view} />
}

// ADR-026, CAP-020-R17
export function PageThumbnail({ pageId, ...view }: ViewProps & { pageId: string | undefined }) {
	return <RemoteThumbnail state={usePageThumbnail(pageId)} {...view} />
}
