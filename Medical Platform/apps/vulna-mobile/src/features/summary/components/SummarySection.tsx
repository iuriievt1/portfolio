import type { ReactNode } from "react"
import { View } from "react-native"
import { OpenRow } from "../../../ui/OpenRow"
import { Caption, Label, TEXT_TONE } from "../../../ui/typography"

interface Props {
	eyebrow: string
	value?: string
	children?: ReactNode
	onOpen?: () => void
}

// CAP-014-R14
export function SummarySection({ eyebrow, value, children, onOpen }: Props) {
	const content = (
		<View className="flex-1 gap-0.5">
			<Caption tone={TEXT_TONE.MUTED}>{eyebrow}</Caption>
			{value === undefined ? null : <Label>{value}</Label>}
			{children}
		</View>
	)
	if (onOpen === undefined) {
		return <View className="py-3">{content}</View>
	}
	return (
		<OpenRow className="-mx-screen py-3" onPress={onOpen}>
			{content}
		</OpenRow>
	)
}
