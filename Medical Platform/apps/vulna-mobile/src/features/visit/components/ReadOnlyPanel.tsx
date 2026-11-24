import { type LayoutChangeEvent, View } from "react-native"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { PanelHairline } from "../../../ui/PanelHairline"
import { Caption, TEXT_TONE } from "../../../ui/typography"

interface Props {
	caption: string | undefined
	close: string
	onClose: () => void
	onLayout: (event: LayoutChangeEvent) => void
}

// CAP-014-R21, CAP-014-R30
export function ReadOnlyPanel({ caption, close, onClose, onLayout }: Props) {
	return (
		<View
			className="absolute right-0 bottom-0 left-0 gap-2 rounded-t-sheet bg-card px-screen pt-4 pb-safe-gap-or-sheet"
			onLayout={onLayout}
		>
			<PanelHairline />
			{caption === undefined ? null : <Caption tone={TEXT_TONE.MUTED}>{caption}</Caption>}
			<Button label={close} onPress={onClose} style={BUTTON_STYLE.SECONDARY} />
		</View>
	)
}
