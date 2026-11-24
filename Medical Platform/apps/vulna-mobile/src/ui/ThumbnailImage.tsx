import { Image, type ImageResizeMode, View } from "react-native"

export const WHOLE_PHOTO: ImageResizeMode = "contain"
const COVER: ImageResizeMode = "cover"

interface Props {
	uri: string | undefined
	className: string
	placeholderClassName: string
	resizeMode?: ImageResizeMode
}

// ADR-026
export function ThumbnailImage({ uri, className, placeholderClassName, resizeMode = COVER }: Props) {
	if (uri === undefined) {
		return <View className={`${className} ${placeholderClassName}`} />
	}
	return <Image source={{ uri }} className={className} resizeMode={resizeMode} />
}
