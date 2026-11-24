import { describe, expect, it } from 'vitest'
import { feedCell, feedZoomTransform, mosaicLayout } from '../mosaic-geometry'

/** A plain quadrant, for exercising the zoom maths independently of any real mosaic layout. */
const QUADRANTS = [
	{ left: 0, top: 0, width: 0.5, height: 0.5 },
	{ left: 0.5, top: 0, width: 0.5, height: 0.5 },
	{ left: 0, top: 0.5, width: 0.5, height: 0.5 },
	{ left: 0.5, top: 0.5, width: 0.5, height: 0.5 },
]

describe('mosaicLayout', () => {
	// Measured off real VSPP Engage frames (see the layout comments): the tiles are inset from
	// the frame, they do not run edge to edge.
	it('lays 4 feeds out as an inset 2x2 grid', () => {
		expect(mosaicLayout(4)).toEqual([
			{ left: 0.0328125, top: 0.0194444, width: 0.4609375, height: 0.4609375 },
			{ left: 0.5046875, top: 0.0194444, width: 0.4609375, height: 0.4609375 },
			{ left: 0.0328125, top: 0.5138889, width: 0.4609375, height: 0.4609375 },
			{ left: 0.5046875, top: 0.5138889, width: 0.4609375, height: 0.4609375 },
		])
	})

	it('leaves a margin around the 4-up grid rather than filling the frame', () => {
		const cells = mosaicLayout(4)

		expect(Math.min(...cells.map((cell) => cell.left))).toBeGreaterThan(0)
		expect(Math.max(...cells.map((cell) => cell.left + cell.width))).toBeLessThan(1)
	})

	it('lays 2 feeds out as two 16:9 tiles side by side', () => {
		const [left, right] = mosaicLayout(2)

		expect(left.top).toBeCloseTo(right.top, 5)
		expect(left.width).toBeCloseTo(0.461, 3)
		expect(right.left).toBeGreaterThan(left.left + left.width)
		// A 16:9 tile in a 16:9 frame takes the same fraction of width as of height.
		expect(left.width).toBeCloseTo(left.height, 5)
		expect(right.width).toBeCloseTo(right.height, 5)
	})

	// The composer reuses one cell grid: the 2-up row sits in the same columns as the 4-up.
	it('puts the 2-up tiles in the same columns as the 4-up', () => {
		const two = mosaicLayout(2)
		const four = mosaicLayout(4)

		expect(two[0].left).toBeCloseTo(four[0].left, 6)
		expect(two[1].left).toBeCloseTo(four[1].left, 6)
		expect(two[0].width).toBeCloseTo(four[0].width, 6)
	})

	it('centres the 2-up row vertically', () => {
		const cells = mosaicLayout(2)
		const top = Math.min(...cells.map((cell) => cell.top))
		const bottom = Math.max(...cells.map((cell) => cell.top + cell.height))

		expect(top).toBeCloseTo(1 - bottom, 2)
	})

	it('lays 3 feeds out as one large tile plus two stacked', () => {
		const [big, topRight, bottomRight] = mosaicLayout(3)

		expect(big.width).toBeCloseTo(0.627, 3)
		expect(big.height).toBeCloseTo(0.627, 3)
		expect(topRight.left).toBeCloseTo(0.672, 3)
		expect(topRight.width).toBeCloseTo(0.3, 3)
		// Right column stacks: the second tile starts below the first.
		expect(bottomRight.left).toBeCloseTo(topRight.left, 5)
		expect(bottomRight.top).toBeGreaterThan(topRight.top + topRight.height)
	})

	// The right column is exactly as tall as the big tile, so the three feeds share one baseline.
	it('ends the 3-up right column level with the large tile', () => {
		const [big, , bottomRight] = mosaicLayout(3)

		expect(bottomRight.top + bottomRight.height).toBeCloseTo(big.top + big.height, 2)
	})

	it('keeps every tile at 16:9 inside a 16:9 frame', () => {
		for (const count of [2, 3, 4]) {
			for (const cell of mosaicLayout(count)) {
				// Equal fractions of a 16:9 frame is what makes the tile itself 16:9.
				expect(cell.width).toBeCloseTo(cell.height, 5)
			}
		}
	})

	// Near-centred, not exactly: the real 3-up frame sits ~5px (of 720) above centre.
	it('centres the 3-up row vertically to within a few pixels', () => {
		const cells = mosaicLayout(3)
		const top = Math.min(...cells.map((cell) => cell.top))
		const bottom = Math.max(...cells.map((cell) => cell.top + cell.height))

		expect(Math.abs(top - (1 - bottom))).toBeLessThan(0.01)
	})

	it('never returns an empty layout', () => {
		expect(mosaicLayout(1)).toEqual([{ left: 0, top: 0, width: 1, height: 1 }])
		expect(mosaicLayout(0)).toHaveLength(1)
		expect(mosaicLayout(-3)).toHaveLength(1)
	})

	it('keeps the 2x2 frame for counts past four', () => {
		expect(mosaicLayout(5)).toEqual(mosaicLayout(4))
	})
})

describe('feedCell', () => {
	it('clamps an out-of-range feed into the layout', () => {
		expect(feedCell(4, 9)).toEqual(feedCell(4, 3))
		expect(feedCell(4, -1)).toEqual(feedCell(4, 0))
	})

	it('reads the 3-up tiles in feed order', () => {
		expect(feedCell(3, 2)).toEqual(mosaicLayout(3)[2])
	})
})

describe('feedZoomTransform', () => {
	const base = {
		containerWidth: 800,
		containerHeight: 600,
		videoRect: { left: 0, top: 0, width: 800, height: 600 },
	}

	it('scales the top-left tile to fill the container', () => {
		expect(feedZoomTransform({ ...base, cell: QUADRANTS[0] })).toEqual({
			scale: 2,
			translateX: 0,
			translateY: 0,
			clip: { top: 0, left: 0, right: 400, bottom: 300 },
		})
	})

	it('offsets the bottom-right tile into view', () => {
		expect(feedZoomTransform({ ...base, cell: QUADRANTS[3] })).toEqual({
			scale: 2,
			translateX: -800,
			translateY: -600,
			clip: { top: 300, left: 400, right: 0, bottom: 0 },
		})
	})

	it('zooms the right tile of a 2-up mosaic', () => {
		const cell = mosaicLayout(2)[1]
		const zoom = feedZoomTransform({ ...base, cell })

		expect(zoom?.scale).toBeCloseTo(800 / (800 * cell.width), 4)
		expect(zoom?.clip.left).toBeCloseTo(800 * cell.left, 4)
		expect(zoom?.clip.top).toBeCloseTo(600 * cell.top, 4)
	})

	it('zooms the large tile of a 3-up mosaic', () => {
		const cell = mosaicLayout(3)[0]
		const zoom = feedZoomTransform({ ...base, cell })

		expect(zoom?.scale).toBeCloseTo(800 / (800 * 0.6265625), 4)
		expect(zoom?.clip.left).toBeCloseTo(800 * 0.015625, 4)
		expect(zoom?.clip.top).toBeCloseTo(600 * 0.1833333, 4)
	})

	it('accounts for the letterboxed video rect, not the container', () => {
		// 2:1 video inside a 4:3 container → 100px bars top and bottom.
		const rect = { left: 0, top: 100, width: 800, height: 400 }
		expect(feedZoomTransform({ ...base, videoRect: rect, cell: QUADRANTS[1] })).toEqual({
			scale: 2,
			translateX: -800,
			translateY: -100,
			clip: { top: 100, left: 400, right: 0, bottom: 300 },
		})
	})

	it('trims the overscan off every tile edge', () => {
		const zoom = feedZoomTransform({ ...base, cell: QUADRANTS[0], overscan: 10 })

		// 400x300 cell trimmed by 10px a side → 380x280, scaled to fit 800x600.
		expect(zoom?.scale).toBeCloseTo(800 / 380)
		expect(zoom?.clip).toEqual({ top: 10, left: 10, right: 410, bottom: 310 })
	})

	it('clamps an overscan that would collapse the tile', () => {
		const zoom = feedZoomTransform({ ...base, cell: QUADRANTS[0], overscan: 10_000 })

		expect(zoom?.scale).toBeGreaterThan(0)
		expect(Number.isFinite(zoom?.scale)).toBe(true)
	})

	it('returns null until the geometry is measurable', () => {
		expect(feedZoomTransform({ ...base, containerWidth: 0, cell: QUADRANTS[0] })).toBeNull()
		expect(
			feedZoomTransform({ ...base, videoRect: { left: 0, top: 0, width: 0, height: 0 }, cell: QUADRANTS[0] }),
		).toBeNull()
		expect(feedZoomTransform({ ...base, containerHeight: Number.NaN, cell: QUADRANTS[0] })).toBeNull()
	})
})
