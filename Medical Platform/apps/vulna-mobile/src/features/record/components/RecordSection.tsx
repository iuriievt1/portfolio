import type { ReactNode } from "react"
import { View } from "react-native"
import { Caption, Detail, Label, TEXT_TONE } from "../../../ui/typography"

interface Props {
	eyebrow: string
	value?: string
	detail?: string
	children?: ReactNode
}

// E108, Vulna / Summary / Row
export function RecordSection({ eyebrow, value, detail, children }: Props) {
	return (
		<View className="min-h-control justify-center gap-0.5 py-3">
			<Caption tone={TEXT_TONE.MUTED}>{eyebrow}</Caption>
			{value === undefined ? null : <Label>{value}</Label>}
			{detail === undefined ? null : <Detail>{detail}</Detail>}
			{children}
		</View>
	)
}
