import { useTexts } from "../../../i18n/language-store"
import { CONTROL_FONT_SCALE } from "../../../ui/font-scale"
import { Label, TEXT_TONE } from "../../../ui/typography"
import { fileCounterLabelOf, fileCounterOf } from "../file-counter"

interface Props {
	count: number
	limit: number
	label: string
}

// CAP-015-R13, CAP-018-R12
export function FileCounter({ count, limit, label }: Props) {
	const texts = useTexts()
	return (
		<Label
			tone={TEXT_TONE.ON_BRAND}
			className="pr-screen"
			accessibilityLabel={fileCounterLabelOf(label, count, limit, texts)}
			numberOfLines={1}
			maxFontSizeMultiplier={CONTROL_FONT_SCALE}
		>
			{fileCounterOf(count, limit, texts)}
		</Label>
	)
}
