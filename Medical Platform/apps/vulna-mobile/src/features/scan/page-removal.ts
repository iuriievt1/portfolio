import { Alert } from "react-native"
import type { Texts } from "../../i18n/texts"

const DESTRUCTIVE = "destructive"
const CANCEL = "cancel"

// CAP-018-R11, Figma 06 B.4
export function confirmPageRemoval(texts: Texts, onRemove: () => void): void {
	const review = texts.scan.review
	Alert.alert(review.removeTitle, review.removeBody, [
		{ text: review.remove, style: DESTRUCTIVE, onPress: onRemove },
		{ text: review.cancel, style: CANCEL },
	])
}
