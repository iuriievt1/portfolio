import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import { OpenIcon } from "../../../ui/icons/OpenIcon"
import { Label } from "../../../ui/typography"

interface Props {
	icon: ReactNode
	tint: string
	title: string
	onPress: () => void
}

// E98
export function CategoryRow({ icon, tint, title, onPress }: Props) {
	return (
		<Pressable
			className="group min-h-14 flex-row items-center gap-3 px-screen py-3"
			accessibilityRole="button"
			onPress={onPress}
		>
			<View className="absolute inset-0 hidden bg-foreground/10 group-active:flex" />
			<View className={`h-category w-category items-center justify-center rounded-full ${tint}`}>{icon}</View>
			<Label className="flex-1">{title}</Label>
			<OpenIcon />
		</Pressable>
	)
}
