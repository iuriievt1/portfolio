import { Label, TEXT_TONE } from "../../../ui/typography"

interface Props {
	title: string
	isFirst: boolean
}

// E109, E110
export function SectionTitle({ title, isFirst }: Props) {
	return (
		<Label className={`px-screen pb-1 ${isFirst ? "" : "pt-8"}`} tone={TEXT_TONE.MUTED} accessibilityRole="header">
			{title}
		</Label>
	)
}
