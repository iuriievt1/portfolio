import { useSyncExternalStore } from "react"

let ended = false
const listeners = new Set<() => void>()

export function endSession(): void {
	ended = true
	for (const listener of listeners) {
		listener()
	}
}

export function useSessionEnded(): boolean {
	return useSyncExternalStore(subscribe, () => ended)
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}
