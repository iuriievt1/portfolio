import { useEffect, useState } from "react"

// DESIGN.md 9.2
export const SEARCH_DEBOUNCE_MILLISECONDS = 250

export function useDebouncedValue<T>(value: T, delayMilliseconds: number): T {
	const [settled, setSettled] = useState(value)
	useEffect(() => {
		const timer = setTimeout(() => setSettled(value), delayMilliseconds)
		return () => clearTimeout(timer)
	}, [value, delayMilliseconds])
	return settled
}
