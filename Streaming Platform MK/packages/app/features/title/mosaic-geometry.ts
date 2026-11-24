// Geometry for zooming the composited mosaic stream onto a single feed. The mosaic is one video
// with the feeds baked into its frame, so "opening a feed full screen" is a scale + translate of
// the video box. The tiles are not always a uniform grid (see MOSAIC_LAYOUTS), so each feed
// carries its own rect rather than a row/column index.

export type MosaicRect = { left: number; top: number; width: number; height: number }

/** One feed's tile, as fractions (0..1) of the composited video frame. */
export type MosaicCell = MosaicRect

export type MosaicZoom = {
	scale: number
	translateX: number
	translateY: number
	/** `inset()` clip in untransformed container pixels, so no neighbouring feed bleeds in. */
	clip: { top: number; right: number; bottom: number; left: number }
}

type ZoomParams = {
	/** Letterboxed video content rect, in container pixels. */
	videoRect: MosaicRect
	containerWidth: number
	containerHeight: number
	/** The feed's tile, from `mosaicLayout`. */
	cell: MosaicCell
	/** Pixels cropped from every tile edge, hiding its rounded corners (#66). */
	overscan?: number
}

// Every layout below is measured off real VSPP Engage frames (2026-09-09, `mv-test`,
// `mv-test-2up`, `mv-test-3us`, all 1280x720, stable across segments). The tiles do NOT run edge
// to edge: the composer keeps each tile at exactly 16:9 and centres the block, so a margin and a
// gutter are baked into the frame. A tile is therefore given as the same fraction of width and of
// height — which is what makes it 16:9 inside a 16:9 frame.

/**
 * 2-up: two tiles (590 x 332) at x=42 and x=646, the row centred vertically at y=194 — the same
 * two columns the 4-up uses, so the composer clearly reuses one cell grid.
 */
const TWO_UP_LAYOUT: MosaicCell[] = [
	{ left: 0.0328125, top: 0.2694444, width: 0.4609375, height: 0.4609375 },
	{ left: 0.5046875, top: 0.2694444, width: 0.4609375, height: 0.4609375 },
]

/**
 * 3-up: one tile (802 x 452) at x=20, two stacked (384 x 216) in a column at x=860, y=132/368.
 * The right column ends level with the big tile; the whole block is centred vertically.
 */
const THREE_UP_LAYOUT: MosaicCell[] = [
	{ left: 0.015625, top: 0.1833333, width: 0.6265625, height: 0.6265625 },
	{ left: 0.671875, top: 0.1833333, width: 0.3, height: 0.3 },
	{ left: 0.671875, top: 0.5111111, width: 0.3, height: 0.3 },
]

/**
 * 4-up: four tiles (590 x 332) at x=42/646, y=14/370 — row-major, matching the order
 * `groupAudioFeeds` assigns from the audio suffixes (A B / C D).
 */
const FOUR_UP_LAYOUT: MosaicCell[] = [
	{ left: 0.0328125, top: 0.0194444, width: 0.4609375, height: 0.4609375 },
	{ left: 0.5046875, top: 0.0194444, width: 0.4609375, height: 0.4609375 },
	{ left: 0.0328125, top: 0.5138889, width: 0.4609375, height: 0.4609375 },
	{ left: 0.5046875, top: 0.5138889, width: 0.4609375, height: 0.4609375 },
]

/** A stream that is not a mosaic at all — the whole frame is the one feed. */
const SINGLE_LAYOUT: MosaicCell[] = [{ left: 0, top: 0, width: 1, height: 1 }]

/**
 * Tiles for N feeds, in feed order (the order `groupAudioFeeds` assigns from the audio suffixes).
 * A mosaic wider than four feeds has never been produced; it falls back to the 4-up frame.
 */
export function mosaicLayout(count: number): MosaicCell[] {
	if (count <= 1) return SINGLE_LAYOUT
	if (count === 2) return TWO_UP_LAYOUT
	if (count === 3) return THREE_UP_LAYOUT
	return FOUR_UP_LAYOUT
}

/** The cell a feed occupies, clamped so an out-of-range feed index cannot read past the layout. */
export function feedCell(count: number, feedIndex: number): MosaicCell | null {
	const cells = mosaicLayout(count)
	return cells[Math.min(Math.max(feedIndex, 0), cells.length - 1)] ?? null
}

/**
 * Transform that fills the container with a single mosaic tile, applied to the element that wraps
 * the video (transform-origin `0 0`). Returns null when the geometry is not measurable yet.
 */
export function feedZoomTransform({
	videoRect,
	containerWidth,
	containerHeight,
	cell,
	overscan = 0,
}: ZoomParams): MosaicZoom | null {
	const cellWidth = videoRect.width * cell.width
	const cellHeight = videoRect.height * cell.height
	const measured = [containerWidth, containerHeight, cellWidth, cellHeight]
	if (measured.some((value) => !Number.isFinite(value) || value <= 0)) return null

	// Clamped so an oversized overscan can never collapse the cell it is trimming.
	const inset = Math.max(0, Math.min(overscan, cellWidth / 4, cellHeight / 4))
	const cropWidth = cellWidth - inset * 2
	const cropHeight = cellHeight - inset * 2

	const left = videoRect.left + videoRect.width * cell.left + inset
	const top = videoRect.top + videoRect.height * cell.top + inset

	const scale = Math.min(containerWidth / cropWidth, containerHeight / cropHeight)
	return {
		scale,
		translateX: containerWidth / 2 - scale * (left + cropWidth / 2),
		translateY: containerHeight / 2 - scale * (top + cropHeight / 2),
		clip: {
			top,
			left,
			right: containerWidth - (left + cropWidth),
			bottom: containerHeight - (top + cropHeight),
		},
	}
}
