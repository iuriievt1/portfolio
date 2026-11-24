import { useSyncExternalStore } from "react"

export interface SharedValue<T> {
	get: () => T
	set: (next: T) => void
	subscribe: (listener: () => void) => () => void
}

export function sharedValue<T>(initial: T): SharedValue<T> {
	let value = initial
	const listeners = new Set<() => void>()
	return {
		get: () => value,
		set: (next) => {
			if (Object.is(next, value)) {
				return
			}
			value = next
			for (const listener of listeners) {
				listener()
			}
		},
		subscribe: (listener) => {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
	}
}

export function useSharedValue<T>(shared: SharedValue<T>): T {
	return useSyncExternalStore(shared.subscribe, shared.get)
}
