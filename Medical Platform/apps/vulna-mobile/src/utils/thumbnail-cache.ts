import { useEffect, useRef, useState } from "react"

const shown = new Map<string, Promise<string>>()

// ADR-026, CAP-009-R11
export function shownThumbnail(key: string, read: () => Promise<string>): Promise<string> {
	const cached = shown.get(key)
	if (cached !== undefined) {
		return cached
	}
	const loading = read()
	shown.set(key, loading)
	loading.catch(() => {
		if (shown.get(key) === loading) {
			shown.delete(key)
		}
	})
	return loading
}

// CAP-015-R18, CAP-015-R34
export function forgetThumbnail(key: string): void {
	shown.delete(key)
}

// CAP-002-R21, CAP-013-R08
export function forgetThumbnails(): void {
	shown.clear()
}

// ADR-026
export function useThumbnailUri(key: string | undefined, read: () => Promise<string>): string | undefined {
	const [uri, setUri] = useState<string | undefined>(undefined)
	const reader = useRef(read)
	reader.current = read
	useEffect(() => {
		if (key === undefined) {
			return
		}
		let isCurrent = true
		shownThumbnail(key, () => reader.current())
			.then((loaded) => {
				if (isCurrent) {
					setUri(loaded)
				}
			})
			.catch((failure: unknown) => console.warn("a thumbnail could not be shown", failure))
		return () => {
			isCurrent = false
		}
	}, [key])
	return uri
}
