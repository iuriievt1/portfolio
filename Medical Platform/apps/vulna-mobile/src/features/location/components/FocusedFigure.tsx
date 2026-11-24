import type { ReactNode } from "react"
import Animated, { type EntryExitAnimationFunction, withDelay, withTiming } from "react-native-reanimated"
import {
	DEPTH,
	FADE_IN,
	FADE_IN_DELAY,
	FADE_OUT,
	FOCUSED_FAR_SCALE,
	HIDDEN,
	NATURAL_SCALE,
	SHOWN,
} from "../map-transition"
import type { Placement } from "../wound-map-layout"

interface Props {
	placement: Placement
	children: ReactNode
}

// CAP-016-R17
export function FocusedFigure({ placement, children }: Props) {
	return (
		<Animated.View
			renderToHardwareTextureAndroid
			style={{
				position: "absolute",
				left: placement.x,
				top: placement.y,
				width: placement.width,
				height: placement.height,
			}}
			entering={arrival}
			exiting={departure}
		>
			{children}
		</Animated.View>
	)
}

// CAP-016-R17
const arrival: EntryExitAnimationFunction = () => {
	"worklet"
	return {
		initialValues: { opacity: HIDDEN, transform: [{ scale: FOCUSED_FAR_SCALE }] },
		animations: {
			opacity: withDelay(FADE_IN_DELAY, withTiming(SHOWN, FADE_IN)),
			transform: [{ scale: withTiming(NATURAL_SCALE, DEPTH) }],
		},
	}
}

// CAP-016-R17
const departure: EntryExitAnimationFunction = () => {
	"worklet"
	return {
		initialValues: { opacity: SHOWN, transform: [{ scale: NATURAL_SCALE }] },
		animations: {
			opacity: withTiming(HIDDEN, FADE_OUT),
			transform: [{ scale: withTiming(FOCUSED_FAR_SCALE, DEPTH) }],
		},
	}
}
