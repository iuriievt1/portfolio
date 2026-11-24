'use client'

import type { FeedDescriptor } from '@pkg/app/data'
import type { RailData } from '@pkg/design-system'
import { useCallback, useEffect, useRef, useState } from 'react'
import { withBasePath } from '@/utils'
import { RailClient } from './RailClient'
import { RailSkeleton } from './RailSkeleton'

const BATCH_SIZE = 3

export function InfiniteRails({ feeds }: { feeds: FeedDescriptor[] }) {
	const sentinelRef = useRef<HTMLDivElement>(null)
	const [rails, setRails] = useState<(RailData | null)[]>([])
	const [cursor, setCursor] = useState(0)
	const [loading, setLoading] = useState(false)
	const done = cursor >= feeds.length

	const loadBatch = useCallback(async () => {
		if (loading || done) return
		setLoading(true)

		const batch = feeds.slice(cursor, cursor + BATCH_SIZE)

		try {
			const res = await fetch(withBasePath('/api/rails/'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ feeds: batch }),
			})

			if (!res.ok) throw new Error(`Rail fetch failed: ${res.status}`)

			const data: (RailData | null)[] = await res.json()
			setRails((prev) => [...prev, ...data])
			setCursor((prev) => prev + batch.length)
		} catch (err) {
			// Logged in production too — the demo deploy is where this needs debugging.
			console.error('[InfiniteRails] Failed to load batch:', err)
		} finally {
			setLoading(false)
		}
	}, [cursor, done, feeds, loading])

	useEffect(() => {
		const el = sentinelRef.current
		if (!el || done) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					loadBatch()
				}
			},
			{ rootMargin: '400px' },
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [done, loadBatch])

	return (
		<>
			{rails.map((rail) => (rail ? <RailClient key={rail.id} rail={rail} /> : null))}
			{loading && <RailSkeleton />}
			{!done && <div ref={sentinelRef} />}
		</>
	)
}
