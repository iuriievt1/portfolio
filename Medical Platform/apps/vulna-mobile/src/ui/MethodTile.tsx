import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import { Caption } from "./typography"

interface Props {
	icon: ReactNode
	label: string
	onPress: () => void
	onLongPress?: () => void
}

export function MethodTile({ icon, label, onPress, onLongPress }: Props) {
	return (
		<Pressable
			className="group h-method flex-1 items-center justify-center gap-1 overflow-hidden rounded-control"
			onPress={onPress}
			onLongPress={onLongPress}
		>
			<View className="absolute inset-0 rounded-control bg-foreground/10" />
			<View className="absolute inset-0 hidden rounded-control bg-foreground/10 group-active:flex" />
			{icon}
			<Caption>{label}</Caption>
		</Pressable>
	)
}
