import type { ReactNode } from "react"
import { Pressable } from "react-native"
import { DarkGlass, LightGlass } from "./Glass"
import { GLASS_SHADOW } from "./shadow"

export const GLASS_LOOK = {
	DARK: "dark",
	LIGHT: "light",
} as const

type GlassLook = (typeof GLASS_LOOK)[keyof typeof GLASS_LOOK]

const SHAPE = "h-11 w-11 items-center justify-center rounded-full"

interface Props {
	label: string
	look?: GlassLook
	onPress: () => void
	children: ReactNode
}

export function GlassAction({ label, look = GLASS_LOOK.DARK, onPress, children }: Props) {
	return (
		<Pressable
			className="rounded-full"
			style={GLASS_SHADOW}
			accessibilityRole="button"
			accessibilityLabel={label}
			onPress={onPress}
		>
			{look === GLASS_LOOK.LIGHT ? (
				<LightGlass className={SHAPE} plainClassName="bg-secondary" isInteractive>
					{children}
				</LightGlass>
			) : (
				<DarkGlass className={SHAPE} plainClassName="border border-glass-border bg-glass-base">
					{children}
				</DarkGlass>
			)}
		</Pressable>
	)
}
