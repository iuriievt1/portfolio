/**
 * Geometry for the switcher's own scrollbar. Kept apart from the component so the
 * bar is driven by what the scroll element actually measures, never by a row count.
 */

/** Fractional row heights leave a hair of overflow on a list that visibly fits. */
const OVERFLOW_EPSILON = 1

export type ScrollMetrics = {
	/** True only when the content really is taller than the visible region. */
	overflows: boolean
	/** Visible fraction of the content — the thumb's share of the track. */
	ratio: number
	/** 0…1 position of the thumb within its free travel. */
	progress: number
}

const NO_OVERFLOW: ScrollMetrics = { overflows: false, ratio: 1, progress: 0 }

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function measureScroll({
	scrollTop,
	scrollHeight,
	clientHeight,
}: {
	scrollTop: number
	scrollHeight: number
	clientHeight: number
}): ScrollMetrics {
	if (!Number.isFinite(scrollHeight) || !Number.isFinite(clientHeight) || clientHeight <= 0) return NO_OVERFLOW

	const overflow = scrollHeight - clientHeight
	if (overflow <= OVERFLOW_EPSILON) return NO_OVERFLOW

	return {
		overflows: true,
		ratio: clamp01(clientHeight / scrollHeight),
		progress: clamp01((Number.isFinite(scrollTop) ? scrollTop : 0) / overflow),
	}
}

/**
 * Where to scroll to for a pointer dragging the thumb. `grabOffset` is how far down
 * the thumb the drag started, so the thumb stays under the cursor rather than jumping.
 */
export function scrollTopForPointer({
	pointerY,
	trackTop,
	trackHeight,
	ratio,
	scrollHeight,
	clientHeight,
	grabOffset,
}: {
	pointerY: number
	trackTop: number
	trackHeight: number
	ratio: number
	scrollHeight: number
	clientHeight: number
	grabOffset: number
}): number {
	const travel = trackHeight - ratio * trackHeight
	if (travel <= 0) return 0

	const thumbTop = Math.min(travel, Math.max(0, pointerY - trackTop - grabOffset))
	return (thumbTop / travel) * (scrollHeight - clientHeight)
}
