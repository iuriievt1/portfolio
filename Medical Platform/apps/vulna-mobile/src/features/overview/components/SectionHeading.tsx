import type { ReactNode } from "react"
import { View } from "react-native"
import { Heading, Label, TEXT_TONE } from "../../../ui/typography"

interface Props {
	icon: ReactNode
	title: string
	value?: string
	className?: string
}

export function SectionHeading({ icon, title, value, className = "" }: Props) {
	return (
		<View className={`flex-row items-center gap-3 px-screen ${className}`}>
			{icon}
			<Heading className="flex-1">{title}</Heading>
			{value === undefined ? null : <Label tone={TEXT_TONE.MUTED}>{value}</Label>}
		</View>
	)
}
