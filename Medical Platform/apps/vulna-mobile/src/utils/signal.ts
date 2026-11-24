export interface Signal {
	emit: () => void
	listen: (listener: () => void) => () => void
}

export function signal(): Signal {
	const listeners = new Set<() => void>()
	return {
		emit: () => {
			for (const listener of listeners) {
				listener()
			}
		},
		listen: (listener) => {
			listeners.add(listener)
			return () => {
				listeners.delete(listener)
			}
		},
	}
}
