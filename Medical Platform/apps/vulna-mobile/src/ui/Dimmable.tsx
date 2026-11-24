import { type ReactNode, useEffect } from "react"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import opacity from "../styles/opacity.json"

const DIMMED_OPACITY = Number(opacity.dim)
const FULL_OPACITY = 1
const DIMMING_MILLISECONDS = 200

interface Props {
	dimmed: boolean
	className?: string
	children: ReactNode
}

export function Dimmable({ dimmed, className, children }: Props) {
	const shown = useSharedValue(dimmed ? DIMMED_OPACITY : FULL_OPACITY)
	useEffect(() => {
		shown.value = withTiming(dimmed ? DIMMED_OPACITY : FULL_OPACITY, { duration: DIMMING_MILLISECONDS })
	}, [dimmed, shown])
	const style = useAnimatedStyle(() => ({ opacity: shown.value }))
	return (
		<Animated.View className={className} style={style} pointerEvents={dimmed ? "none" : "auto"}>
			{children}
		</Animated.View>
	)
}
