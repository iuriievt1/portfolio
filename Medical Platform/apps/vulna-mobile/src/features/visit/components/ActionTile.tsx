import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import { Label } from "../../../ui/typography"

interface Props {
	icon: ReactNode
	label: string
	surface: string
	caption: string
	onPress: () => void
}

// CAP-015-R30
export function ActionTile({ icon, label, surface, caption, onPress }: Props) {
	return (
		<Pressable
			className={`group h-tile flex-1 flex-row items-center justify-center gap-2.5 rounded-tile ${surface}`}
			accessibilityRole="button"
			onPress={onPress}
		>
			<View className="absolute inset-0 hidden rounded-tile bg-foreground/10 group-active:flex" />
			{icon}
			<Label className={caption}>{label}</Label>
		</Pressable>
	)
}
