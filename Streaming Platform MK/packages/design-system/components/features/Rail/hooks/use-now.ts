'use client'

import { useEffect, useState } from 'react'

/** Live progress advances ~1px per 7s on a 30-minute programme, so this is smooth enough. */
const TICK_MS = 10_000

// One interval shared by every subscriber — a rail can hold a lot of live cards.
const subscribers = new Set<(now: number) => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(notify: (now: number) => void): () => void {
	subscribers.add(notify)
	if (!timer) {
		timer = setInterval(() => {
			const now = Date.now()
			for (const subscriber of subscribers) subscriber(now)
		}, TICK_MS)
	}

	return () => {
		subscribers.delete(notify)
		if (subscribers.size === 0 && timer) {
			clearInterval(timer)
			timer = null
		}
	}
}

/** Wall clock that re-renders its consumers on every tick. */
export function useNow(): number {
	const [now, setNow] = useState(() => Date.now())
	useEffect(() => subscribe(setNow), [])
	return now
}
