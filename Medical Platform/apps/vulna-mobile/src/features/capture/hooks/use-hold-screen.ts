import { useNavigation, usePreventRemove } from "expo-router"
import { useEffect } from "react"

// CAP-002-R21, CAP-012-R25
const BACK_ACTIONS: ReadonlySet<string> = new Set(["GO_BACK", "POP"])

// CAP-015-R34
export function useHoldScreen(isHeld: boolean): void {
	const navigation = useNavigation()
	const parent = navigation.getParent()

	useEffect(() => {
		navigation.setOptions({ gestureEnabled: !isHeld })
		parent?.setOptions({ gestureEnabled: !isHeld })
	}, [isHeld, navigation, parent])

	usePreventRemove(isHeld, ({ data, repeat }) => {
		if (BACK_ACTIONS.has(data.action.type)) {
			return
		}
		repeat()
	})
}
