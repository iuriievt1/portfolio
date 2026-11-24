import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect"
import { cssInterop } from "nativewind"
import type { ReactNode } from "react"
import { View } from "react-native"
import colors from "../styles/colors.json"

const Surface = cssInterop(GlassView, { className: "style" })

interface Props {
	className: string
	plainClassName: string
	children?: ReactNode
}

export function DarkGlass({ className, plainClassName, children }: Props) {
	if (!isLiquidGlassAvailable()) {
		return <View className={`${className} ${plainClassName}`}>{children}</View>
	}

	return (
		<Surface
			className={className}
			glassEffectStyle="clear"
			colorScheme="dark"
			tintColor={colors["glass-tint"]}
			isInteractive
		>
			{children}
		</Surface>
	)
}

export function LightGlass({
	className,
	plainClassName,
	isInteractive = false,
	children,
}: Props & { isInteractive?: boolean }) {
	if (!isLiquidGlassAvailable()) {
		return <View className={`${className} ${plainClassName}`}>{children}</View>
	}

	return (
		<Surface className={className} glassEffectStyle="regular" colorScheme="light" isInteractive={isInteractive}>
			{children}
		</Surface>
	)
}
