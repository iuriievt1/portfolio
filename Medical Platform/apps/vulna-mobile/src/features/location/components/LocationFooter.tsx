import { useEffect } from "react"
import { View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated"
import { useTexts } from "../../../i18n/language-store"
import { Button } from "../../../ui/Button"
import { Detail, Label } from "../../../ui/typography"
import { FOOTER_FADE_IN, FOOTER_FADE_IN_DELAY, FOOTER_FADE_OUT, HIDDEN, SHOWN } from "../map-transition"

interface Props {
	hasChoice: boolean
	isSaving: boolean
	onContinue: () => void
}

// CAP-016-R17, E106, Figma 05 B.3
export function LocationFooter({ hasChoice, isSaving, onContinue }: Props) {
	const texts = useTexts().capture.location
	const hintOpacity = useSharedValue(hasChoice ? HIDDEN : SHOWN)
	const buttonOpacity = useSharedValue(hasChoice ? SHOWN : HIDDEN)

	useEffect(() => {
		const [leaving, arriving] = hasChoice ? [hintOpacity, buttonOpacity] : [buttonOpacity, hintOpacity]
		leaving.value = withTiming(HIDDEN, FOOTER_FADE_OUT)
		arriving.value = withDelay(FOOTER_FADE_IN_DELAY, withTiming(SHOWN, FOOTER_FADE_IN))
	}, [hasChoice, hintOpacity, buttonOpacity])

	const hintFade = useAnimatedStyle(() => ({ opacity: hintOpacity.value }))
	const buttonFade = useAnimatedStyle(() => ({ opacity: buttonOpacity.value }))

	return (
		<View className="px-screen pt-4 pb-safe-gap-or-sheet">
			<View className="min-h-control justify-center">
				<Animated.View
					className="gap-1"
					style={hintFade}
					pointerEvents="none"
					importantForAccessibility={hasChoice ? "no-hide-descendants" : "auto"}
					accessibilityElementsHidden={hasChoice}
				>
					<Label>{texts.hint.heading}</Label>
					<Detail>{texts.hint.body}</Detail>
				</Animated.View>
				<Animated.View
					className="absolute right-0 bottom-0 left-0"
					style={buttonFade}
					pointerEvents={hasChoice ? "auto" : "none"}
					importantForAccessibility={hasChoice ? "auto" : "no-hide-descendants"}
					accessibilityElementsHidden={!hasChoice}
				>
					<Button label={texts.continue} onPress={onContinue} disabled={!hasChoice || isSaving} />
				</Animated.View>
			</View>
		</View>
	)
}
