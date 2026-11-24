import { Pressable, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { CameraIcon } from "../../../ui/icons/CameraIcon"
import { ICON_LOOK } from "../../../ui/icons/icon-look"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { Body, Heading, Label, TEXT_TONE } from "../../../ui/typography"
import { openSettings } from "../../../utils/open-settings"

// CAP-015-S02, E16, Figma 05 G
export function CameraDenied() {
	const texts = useTexts().capture.denied
	return (
		<View className="flex-1 justify-center gap-6 bg-capture-denied-surface px-screen">
			<View className="gap-4">
				<CameraIcon look={ICON_LOOK.FEEDBACK_ON_DARK} />
				<Heading tone={TEXT_TONE.ON_DARK}>{texts.heading}</Heading>
				<Body tone={TEXT_TONE.ON_DARK_MUTED}>{texts.body}</Body>
			</View>
			<Pressable
				className="group h-control items-center justify-center rounded-control bg-capture-denied-action px-4"
				accessibilityRole="button"
				onPress={openSettings}
			>
				<PressedOverlay className="rounded-control" />
				<Label tone={TEXT_TONE.ON_BRAND} numberOfLines={1} maxFontSizeMultiplier={CONTROL_FONT_SCALE}>
					{texts.settings}
				</Label>
			</Pressable>
		</View>
	)
}
