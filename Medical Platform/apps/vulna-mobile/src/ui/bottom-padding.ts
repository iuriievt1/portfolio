import { Platform } from "react-native"
import sizes from "../styles/sizes.json"

const SYSTEM_BAR_GAP = Platform.OS === "android" ? sizes["android-system-bar-gap"] : 0

export function bottomPaddingOf(systemBarInset: number, minimum: number): number {
	return Math.max(systemBarInset + SYSTEM_BAR_GAP, minimum)
}
