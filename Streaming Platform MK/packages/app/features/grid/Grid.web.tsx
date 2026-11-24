'use client'

import type { RailData } from '@pkg/design-system'
import { Card } from '@pkg/design-system/components/features/Rail'
import { RailMetaContext } from '@pkg/design-system/components/features/Rail/context'
import { cn } from '@pkg/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const INITIAL_ROWS = 3
const ROWS_PER_LOAD = 2

const VARIANT_GRID_CLASSES: Record<string, string> = {
	poster: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 3xl:grid-cols-8',
	backdrop: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6',
	continue: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6',
	live: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-4',
}

/** Fires `onLoad` once each time the returned ref's element scrolls into view (when `enabled`). */
function useInfiniteSentinel(enabled: boolean, onLoad: () => void) {
	const sentinelRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const sentinel = sentinelRef.current
		if (!sentinel || !enabled) return

		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) onLoad()
			},
			{ rootMargin: '200px' },
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [enabled, onLoad])

	return sentinelRef
}

function useGridReveal(totalItems: number, cols: number) {
	const [visibleRows, setVisibleRows] = useState(INITIAL_ROWS)

	const visibleCount = Math.min(visibleRows * cols, totalItems)
	const hasMore = visibleCount < totalItems

	const loadMore = useCallback(() => {
		setVisibleRows((prev) => prev + ROWS_PER_LOAD)
	}, [])

	const sentinelRef = useInfiniteSentinel(hasMore, loadMore)

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on column change
	useEffect(() => {
		setVisibleRows(INITIAL_ROWS)
	}, [cols])

	return { visibleCount, sentinelRef, hasMore }
}

function useGridCols(gridRef: React.RefObject<HTMLDivElement | null>) {
	const [cols, setCols] = useState(4)

	useEffect(() => {
		const el = gridRef.current
		if (!el) return

		const measure = () => {
			const style = getComputedStyle(el)
			const templateCols = style.gridTemplateColumns.split(' ').length
			setCols(templateCols)
		}

		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [gridRef])

	return cols
}

function GridLayout({
	rail,
	items,
	gridRef,
	sentinel,
}: {
	rail: RailData
	items: RailData['items']
	gridRef?: React.RefObject<HTMLDivElement | null>
	sentinel?: React.ReactNode
}) {
	const gridCols = VARIANT_GRID_CLASSES[rail.variant] ?? VARIANT_GRID_CLASSES.backdrop
	const gridClass = cn('grid gap-4 sm:gap-6 lg:gap-8', gridCols)

	// Cards read their shape from the rail meta, so the grid must declare the same one the rail did.
	const meta = useMemo(
		() => ({ railId: rail.id, variant: rail.variant, aspect: rail.aspect }),
		[rail.id, rail.variant, rail.aspect],
	)

	return (
		<RailMetaContext value={meta}>
			<div>
				<div ref={gridRef} className={gridClass}>
					{items.map((item, idx) => (
						<Card key={item.id} item={item} index={idx} cardW={0} style={{ width: '100%' }} />
					))}
				</div>
				{sentinel}
			</div>
		</RailMetaContext>
	)
}

/** Client-side progressive reveal over an already-loaded rail (e.g. genre pages). */
function RevealGrid({ rail }: { rail: RailData }) {
	const gridRef = useRef<HTMLDivElement>(null)
	const cols = useGridCols(gridRef)
	const { visibleCount, sentinelRef, hasMore } = useGridReveal(rail.items.length, cols)

	return (
		<GridLayout
			rail={rail}
			items={rail.items.slice(0, visibleCount)}
			gridRef={gridRef}
			sentinel={hasMore ? <div ref={sentinelRef} className='h-px' /> : null}
		/>
	)
}

/** Server-paginated grid — the sentinel requests the next backend page (View All). */
function ServerPagedGrid({
	rail,
	onLoadMore,
	hasNextPage,
	isFetchingNextPage,
}: {
	rail: RailData
	onLoadMore: () => void
	hasNextPage: boolean
	isFetchingNextPage: boolean
}) {
	const gridRef = useRef<HTMLDivElement>(null)
	const cols = useGridCols(gridRef)

	// Pre-fill the first viewport: keep fetching until we have INITIAL_ROWS rows for the current column count.
	const targetCount = INITIAL_ROWS * cols
	useEffect(() => {
		if (hasNextPage && !isFetchingNextPage && rail.items.length < targetCount) onLoadMore()
	}, [hasNextPage, isFetchingNextPage, rail.items.length, targetCount, onLoadMore])

	const loadMore = useCallback(() => {
		if (!isFetchingNextPage) onLoadMore()
	}, [isFetchingNextPage, onLoadMore])

	const sentinelRef = useInfiniteSentinel(hasNextPage, loadMore)

	return (
		<GridLayout
			rail={rail}
			items={rail.items}
			gridRef={gridRef}
			sentinel={hasNextPage ? <div ref={sentinelRef} className='h-px' /> : null}
		/>
	)
}

type GridProps = {
	rail: RailData
	onLoadMore?: () => void
	hasNextPage?: boolean
	isFetchingNextPage?: boolean
}

export function Grid({ rail, onLoadMore, hasNextPage, isFetchingNextPage }: GridProps) {
	// Server pagination mode when a loader is wired in (View All); otherwise client-side reveal.
	if (onLoadMore) {
		return (
			<ServerPagedGrid
				rail={rail}
				onLoadMore={onLoadMore}
				hasNextPage={hasNextPage ?? false}
				isFetchingNextPage={isFetchingNextPage ?? false}
			/>
		)
	}

	return <RevealGrid rail={rail} />
}
Grid.displayName = 'Grid'
