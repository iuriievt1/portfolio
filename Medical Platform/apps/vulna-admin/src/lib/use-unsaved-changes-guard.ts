import { useEffect } from "react"
import { type Blocker, useBlocker } from "react-router"

// DESIGN.md 9.4
export function useUnsavedChangesGuard(dirty: boolean): Blocker {
	const blocker = useBlocker(
		({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname,
	)
	useEffect(() => {
		if (!dirty) {
			return
		}
		const warn = (event: BeforeUnloadEvent) => event.preventDefault()
		window.addEventListener("beforeunload", warn)
		return () => window.removeEventListener("beforeunload", warn)
	}, [dirty])
	return blocker
}
