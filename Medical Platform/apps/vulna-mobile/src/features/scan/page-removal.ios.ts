import { ActionSheetIOS } from "react-native"
import type { Texts } from "../../i18n/texts"

const REMOVE_INDEX = 0
const CANCEL_INDEX = 1

// CAP-018-R11, Figma 06 B.4
export function confirmPageRemoval(texts: Texts, onRemove: () => void): void {
	const review = texts.scan.review
	ActionSheetIOS.showActionSheetWithOptions(
		{
			title: review.removeTitle,
			message: review.removeBody,
			options: [review.remove, review.cancel],
			destructiveButtonIndex: REMOVE_INDEX,
			cancelButtonIndex: CANCEL_INDEX,
		},
		(index) => {
			if (index === REMOVE_INDEX) {
				onRemove()
			}
		},
	)
}
