import { LinearGradient } from "expo-linear-gradient"
import { type StyleProp, View, type ViewStyle } from "react-native"
import colors from "../styles/colors.json"

export const FOG_HEIGHT = 32
const FOG = [colors["fog-start"], colors.background] as const
const FOG_TOP = { x: 0, y: 0 }
const FOG_BOTTOM = { x: 0, y: 1 }
const FOG_BAND = { height: FOG_HEIGHT }

export function Fog({ style }: { style?: StyleProp<ViewStyle> }) {
	return <LinearGradient colors={FOG} start={FOG_TOP} end={FOG_BOTTOM} style={[FOG_BAND, style]} pointerEvents="none" />
}

export function FogSpacer() {
	return <View style={FOG_BAND} />
}
