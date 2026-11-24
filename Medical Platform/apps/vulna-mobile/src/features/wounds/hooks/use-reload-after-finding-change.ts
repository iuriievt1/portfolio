import { useFocusEffect } from "expo-router"
import { useCallback, useRef } from "react"
import { findingChangeCount } from "../finding-changes"

// CAP-020-R19, CAP-020-R21
export function useReloadAfterFindingChange(reload: () => void): void {
	const seen = useRef(findingChangeCount())
	useFocusEffect(
		useCallback(() => {
			const current = findingChangeCount()
			if (current === seen.current) {
				return
			}
			seen.current = current
			reload()
		}, [reload]),
	)
}
