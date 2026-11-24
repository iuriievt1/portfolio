import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import colors from "../styles/colors.json"
import { CONTROL_FONT_SCALE } from "./font-scale"
import { SPINNER_SIZE, Spinner } from "./Spinner"
import { Label } from "./typography"

export const BUTTON_STYLE = {
	PRIMARY: "primary",
	SECONDARY: "secondary",
	PLAIN: "plain",
} as const

export type ButtonStyle = (typeof BUTTON_STYLE)[keyof typeof BUTTON_STYLE]

interface Props {
	label: string
	onPress: () => void
	style?: ButtonStyle
	disabled?: boolean
	waiting?: boolean
	icon?: ReactNode
}

const SHAPE: Record<ButtonStyle, string> = {
	[BUTTON_STYLE.PRIMARY]: "h-control px-4",
	[BUTTON_STYLE.SECONDARY]: "h-control px-4",
	[BUTTON_STYLE.PLAIN]: "h-link px-4 py-2",
}

const SURFACE: Record<ButtonStyle, string> = {
	[BUTTON_STYLE.PRIMARY]: "bg-primary",
	[BUTTON_STYLE.SECONDARY]: "bg-secondary",
	[BUTTON_STYLE.PLAIN]: "",
}

const DISABLED_SURFACE: Record<ButtonStyle, string> = {
	[BUTTON_STYLE.PRIMARY]: "bg-disabled",
	[BUTTON_STYLE.SECONDARY]: "bg-disabled",
	[BUTTON_STYLE.PLAIN]: "",
}

const CAPTION: Record<ButtonStyle, string> = {
	[BUTTON_STYLE.PRIMARY]: "text-primary-foreground",
	[BUTTON_STYLE.SECONDARY]: "text-foreground",
	[BUTTON_STYLE.PLAIN]: "text-primary",
}

const INDICATOR: Record<ButtonStyle, string> = {
	[BUTTON_STYLE.PRIMARY]: colors["primary-foreground"],
	[BUTTON_STYLE.SECONDARY]: colors.foreground,
	[BUTTON_STYLE.PLAIN]: colors.primary,
}

export function Button({
	label,
	onPress,
	style = BUTTON_STYLE.PRIMARY,
	disabled = false,
	waiting = false,
	icon,
}: Props) {
	const inactive = disabled && !waiting
	return (
		<Pressable
			className={`group ${SHAPE[style]} flex-row items-center justify-center gap-2 rounded-control ${inactive ? DISABLED_SURFACE[style] : SURFACE[style]}`}
			onPress={onPress}
			disabled={disabled || waiting}
		>
			{inactive || waiting ? null : (
				<View className="absolute inset-0 hidden rounded-control bg-foreground/10 group-active:flex" />
			)}
			{icon === undefined || waiting ? null : <View className="absolute left-4">{icon}</View>}
			{waiting ? <Spinner size={SPINNER_SIZE.CONTROL} color={INDICATOR[style]} /> : null}
			<Label
				className={inactive ? "text-disabled-foreground" : CAPTION[style]}
				numberOfLines={1}
				maxFontSizeMultiplier={CONTROL_FONT_SCALE}
			>
				{label}
			</Label>
		</Pressable>
	)
}
