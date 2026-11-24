import { Pressable, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { DismissIcon } from "../../../ui/icons/DismissIcon"
import { Caption, Detail, Label, TEXT_TONE } from "../../../ui/typography"
import type { ChosenWound } from "../chosen-wound"
import type { EarlierPhoto } from "../earlier-photos"
import { EarlierPhotoRow } from "./EarlierPhotoRow"

interface Props {
	chosen: ChosenWound
	earlierPhotos: readonly EarlierPhoto[]
	onClear: () => void
	onOpenEarlier: (imageId: string) => void
}

// CAP-016-R19, CAP-016-R17, E106, Figma 05 B.3
export function LocationDescription({ chosen, earlierPhotos, onClear, onOpenEarlier }: Props) {
	const texts = useTexts().capture.location
	return (
		<View className="gap-3">
			<View className="flex-row items-start gap-2">
				<View className="flex-1 gap-0.5">
					<Caption tone={TEXT_TONE.MUTED}>{chosen.title}</Caption>
					{chosen.region === undefined ? null : <Label>{chosen.region}</Label>}
					<Detail>{chosen.detail}</Detail>
				</View>
				<Pressable
					className="h-11 w-11 items-center justify-center"
					accessibilityRole="button"
					accessibilityLabel={texts.clear}
					onPress={onClear}
				>
					<DismissIcon />
				</Pressable>
			</View>
			{earlierPhotos.length > 0 ? <EarlierPhotoRow photos={earlierPhotos} onSelect={onOpenEarlier} /> : null}
		</View>
	)
}
