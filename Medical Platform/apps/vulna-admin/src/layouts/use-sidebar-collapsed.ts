import { useCallback, useState } from "react"

const COLLAPSED_KEY = "vulna-admin.sidebar-collapsed"

export function useSidebarCollapsed(): [boolean, (collapsed: boolean) => void] {
	const [collapsed, setCollapsed] = useState(storedCollapsed)
	const change = useCallback((next: boolean) => {
		setCollapsed(next)
		storeCollapsed(next)
	}, [])
	return [collapsed, change]
}

function storedCollapsed(): boolean {
	try {
		return localStorage.getItem(COLLAPSED_KEY) === String(true)
	} catch {
		return false
	}
}

function storeCollapsed(collapsed: boolean): void {
	try {
		localStorage.setItem(COLLAPSED_KEY, String(collapsed))
	} catch (error) {
		console.warn("the sidebar state could not be stored", error)
	}
}
