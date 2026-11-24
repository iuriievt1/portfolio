import { type ReactNode, useEffect, useState } from "react"
import { type LayoutChangeEvent, View } from "react-native"
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTexts } from "../../../i18n/language-store"
import sizes from "../../../styles/sizes.json"
import { bottomPaddingOf } from "../../../ui/bottom-padding"
import { FOG_HEIGHT, Fog } from "../../../ui/Fog"
import { NfcIcon } from "../../../ui/icons/NfcIcon"
import { ScanIcon } from "../../../ui/icons/ScanIcon"
import { MethodTile } from "../../../ui/MethodTile"
import { KEYPAD_STYLE, PinKeypad } from "../../unlock/components/PinKeypad"
import type { PatientSearch } from "../hooks/use-patient-search"
import { ClearSearchButton } from "./ClearSearchButton"
import { PatientSearchField } from "./PatientSearchField"
import { SearchResults } from "./SearchResults"

export interface PatientIdentification {
	onTag: (() => void) | undefined
	onCode: () => void
}

interface Props {
	identification: PatientIdentification
	search?: PatientSearch | undefined
	children: ReactNode
}

const FILL = { flex: 1 }
const FOG_ABOVE = { position: "absolute", left: 0, right: 0, top: -FOG_HEIGHT } as const
const KEYPAD_DOCK = { position: "absolute", left: 0, right: 0, bottom: 0 } as const
const DOCK_BOTTOM_MIN = 24
const DOCK_KEYPAD_GAP = 16
const FIELD_TO_KEYPAD = { paddingBottom: DOCK_KEYPAD_GAP, marginBottom: -DOCK_KEYPAD_GAP }
const DOCK_MOTION = { duration: 300, easing: Easing.bezier(0.25, 1, 0.5, 1) }
const CLEAR_SLOT = sizes.search + sizes["search-clear-gap"]

function heightOf(event: LayoutChangeEvent): number {
	return event.nativeEvent.layout.height
}

// CAP-013-R02, CAP-013-R04, CAP-013-R07, CAP-013-R18, CHG-176, CHG-182, E12, E70 to E73
export function PatientFinder({ identification, search, children }: Props) {
	const texts = useTexts()
	const insets = useSafeAreaInsets()
	const isSearching = search?.isActive === true
	const isTyping = search?.isTyping === true
	const dockBottom = bottomPaddingOf(insets.bottom, DOCK_BOTTOM_MIN)
	const [dockHeight, setDockHeight] = useState(0)
	const [fieldHeight, setFieldHeight] = useState(0)
	const [keypadHeight, setKeypadHeight] = useState(0)
	const fieldLift = keypadHeight + DOCK_KEYPAD_GAP - dockBottom
	const coveredByKeypad = isTyping ? Math.max(0, keypadHeight + fieldHeight + FOG_HEIGHT - dockHeight) : 0

	const active = useSharedValue(isSearching ? 1 : 0)
	useEffect(() => {
		active.value = withTiming(isSearching ? 1 : 0, DOCK_MOTION)
	}, [isSearching, active])

	const typing = useSharedValue(isTyping ? 1 : 0)
	useEffect(() => {
		typing.value = withTiming(isTyping ? 1 : 0, DOCK_MOTION)
	}, [isTyping, typing])

	const tilesStyle = useAnimatedStyle(() => ({ opacity: 1 - active.value }))
	const clearStyle = useAnimatedStyle(() => ({
		width: CLEAR_SLOT * active.value,
		opacity: active.value,
		transform: [{ scale: active.value }],
	}))
	const fieldStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -fieldLift * typing.value }] }))
	const fieldFogStyle = useAnimatedStyle(() => ({ opacity: typing.value }))
	const keypadStyle = useAnimatedStyle(() => ({
		opacity: keypadHeight === 0 ? 0 : 1,
		transform: [{ translateY: keypadHeight * (1 - typing.value) }],
	}))

	return (
		<View style={FILL}>
			{search !== undefined && search.query.length > 0 ? (
				<SearchResults search={search} bottomInset={coveredByKeypad} />
			) : (
				children
			)}
			<View
				className="px-screen pt-6"
				style={{ paddingBottom: dockBottom }}
				onLayout={(event) => setDockHeight(heightOf(event))}
			>
				<Fog style={FOG_ABOVE} />
				<Animated.View style={tilesStyle} pointerEvents={isSearching ? "none" : "auto"}>
					<View className={search === undefined ? "flex-row gap-3" : "flex-row gap-3 pb-3"}>
						{identification.onTag === undefined ? null : (
							<MethodTile icon={<NfcIcon />} label={texts.overview.tag} onPress={identification.onTag} />
						)}
						<MethodTile icon={<ScanIcon />} label={texts.overview.code} onPress={identification.onCode} />
					</View>
				</Animated.View>
				{search === undefined ? null : (
					<Animated.View
						className="-mx-screen bg-background px-screen"
						style={[FIELD_TO_KEYPAD, fieldStyle]}
						onLayout={(event) => setFieldHeight(heightOf(event))}
					>
						<Animated.View style={[FOG_ABOVE, fieldFogStyle]} pointerEvents="none">
							<Fog />
						</Animated.View>
						<View className="flex-row items-center">
							<View className="flex-1">
								<PatientSearchField
									placeholder={texts.search.placeholder}
									value={search.query}
									onPress={search.startTyping}
								/>
							</View>
							<Animated.View className="items-end" style={clearStyle} pointerEvents={isSearching ? "auto" : "none"}>
								<ClearSearchButton label={texts.search.clear} onPress={search.clear} />
							</Animated.View>
						</View>
					</Animated.View>
				)}
			</View>
			{search === undefined ? null : (
				<Animated.View
					className="rounded-t-keyboard bg-keyboard"
					style={[KEYPAD_DOCK, keypadStyle]}
					pointerEvents={isTyping ? "auto" : "none"}
					accessibilityElementsHidden={!isTyping}
					importantForAccessibility={isTyping ? "auto" : "no-hide-descendants"}
					onLayout={(event) => setKeypadHeight(heightOf(event))}
				>
					<View className="w-full max-w-entry self-center px-keyboard-edge pt-6 pb-safe-offset-keyboard-bottom">
						<PinKeypad style={KEYPAD_STYLE.KEYBOARD} onDigit={search.type} onErase={search.erase} />
					</View>
				</Animated.View>
			)}
		</View>
	)
}
