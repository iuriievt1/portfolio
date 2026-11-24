import type { ReactNode } from "react"
import { Pressable } from "react-native"
import { OpenIcon } from "./icons/OpenIcon"
import { PressedOverlay } from "./PressedOverlay"

interface Props {
	className?: string
	onPress: () => void
	children: ReactNode
}

export function OpenRow({ className = "py-3", onPress, children }: Props) {
	return (
		<Pressable
			className={`group flex-row items-center gap-3 px-screen ${className}`}
			accessibilityRole="button"
			onPress={onPress}
		>
			<PressedOverlay />
			{children}
			<OpenIcon />
		</Pressable>
	)
}
