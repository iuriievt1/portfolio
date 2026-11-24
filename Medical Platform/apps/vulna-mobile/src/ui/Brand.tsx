import { LinearGradient } from "expo-linear-gradient"
import { StatusBar } from "expo-status-bar"
import type { ReactNode } from "react"
import { View } from "react-native"
import colors from "../styles/colors.json"

const GRADIENT = [colors["brand-start"], colors["brand-end"]] as const
const LEFT_EDGE = { x: 0, y: 0 }
const RIGHT_EDGE = { x: 1, y: 0 }
const FILL = { flex: 1 }

export function BrandScreen({ children }: { children: ReactNode }) {
	return (
		<LinearGradient colors={GRADIENT} start={LEFT_EDGE} end={RIGHT_EDGE} style={FILL}>
			<StatusBar style="light" />
			{children}
		</LinearGradient>
	)
}

export const HEADER_INSET = {
	OVERVIEW: "px-screen pt-safe-offset-4",
	PATIENT: "px-screen pt-safe-offset-nav android:pt-safe-offset-4",
} as const

type HeaderInset = (typeof HEADER_INSET)[keyof typeof HEADER_INSET]

export function BrandHeader({ inset, children }: { inset: HeaderInset; children: ReactNode }) {
	return <View className={`flex-row items-center gap-3 pb-4 ${inset}`}>{children}</View>
}
