'use client'

import type { FeedDescriptor } from '@pkg/app/data'
import type { RailData } from '@pkg/design-system'
import { useCallback, useEffect, useRef, useState } from 'react'
import { RailClient } from './RailClient'
import { RailSkeleton } from './RailSkeleton'

const BATCH_SIZE = 6

export function KidsInfiniteRails({ feeds }: { feeds: FeedDescriptor[] }) {
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
			const { getDataProvider } = await import('@pkg/app/data')
			const provider = await getDataProvider()
			const data: (RailData | null)[] = await Promise.all(batch.map((feed) => provider.getRailData(feed)))
			setRails((prev) => [...prev, ...data])
			setCursor((prev) => prev + batch.length)
		} catch (err) {
			console.error('[KidsInfiniteRails] Failed to load batch:', err)
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
			{loading &&
				Array.from({ length: Math.min(BATCH_SIZE, feeds.length - cursor) }, (_, i) => (
					<RailSkeleton key={`skel-${cursor + i}`} />
				))}
			{!done && <div ref={sentinelRef} />}
		</>
	)
}
