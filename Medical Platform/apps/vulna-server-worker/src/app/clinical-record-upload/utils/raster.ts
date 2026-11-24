import { ORIENTATION, type Orientation } from "./jpeg-segments"

type RgbaPixels = Uint8Array

export interface Raster {
	width: number
	height: number
	data: RgbaPixels
}

const CHANNELS = 4
const COLOUR_CHANNELS = 3
const OPAQUE = 255
const BYTE_MAX = 255
const LINEAR_STEPS = 4095
// IEC 61966-2-1
const SRGB_LINEAR_LIMIT = 0.040_45
const SRGB_LINEAR_SLOPE = 12.92
const SRGB_OFFSET = 0.055
const SRGB_SCALE = 1.055
const SRGB_GAMMA = 2.4
const LINEAR_SRGB_LIMIT = 0.003_130_8

interface Weight {
	source: number
	share: number
}

function toLinear(encoded: number): number {
	const value = encoded / BYTE_MAX
	return value <= SRGB_LINEAR_LIMIT ? value / SRGB_LINEAR_SLOPE : ((value + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_GAMMA
}

function toEncoded(linear: number): number {
	const value =
		linear <= LINEAR_SRGB_LIMIT ? linear * SRGB_LINEAR_SLOPE : SRGB_SCALE * linear ** (1 / SRGB_GAMMA) - SRGB_OFFSET
	return Math.round(Math.min(1, Math.max(0, value)) * BYTE_MAX)
}

const LINEAR_OF = Float32Array.from({ length: BYTE_MAX + 1 }, (_, encoded) => toLinear(encoded))
const ENCODED_OF = Uint8Array.from({ length: LINEAR_STEPS + 1 }, (_, step) => toEncoded(step / LINEAR_STEPS))

function weightsOf(sourceLength: number, targetLength: number): Weight[][] {
	const span = sourceLength / targetLength
	return Array.from({ length: targetLength }, (_, target) => {
		const start = target * span
		const end = start + span
		const weights: Weight[] = []
		for (let source = Math.floor(start); source < Math.min(sourceLength, Math.ceil(end)); source += 1) {
			const covered = Math.min(end, source + 1) - Math.max(start, source)
			if (covered > 0) {
				weights.push({ source, share: covered / span })
			}
		}
		return weights
	})
}

export function targetSizeOf(
	raster: Pick<Raster, "width" | "height">,
	maxLongEdge: number,
): Pick<Raster, "width" | "height"> {
	const longEdge = Math.max(raster.width, raster.height)
	if (longEdge <= maxLongEdge) {
		return { width: raster.width, height: raster.height }
	}
	const scale = maxLongEdge / longEdge
	return {
		width: Math.max(1, Math.round(raster.width * scale)),
		height: Math.max(1, Math.round(raster.height * scale)),
	}
}

// CAP-021-R40, IEC 61966-2-1
export function downscaled(raster: Raster, maxLongEdge: number): Raster {
	const target = targetSizeOf(raster, maxLongEdge)
	if (target.width === raster.width && target.height === raster.height) {
		return raster
	}
	const columns = weightsOf(raster.width, target.width)
	const rows = weightsOf(raster.height, target.height)
	const horizontal = new Float32Array(target.width * raster.height * COLOUR_CHANNELS)
	for (let y = 0; y < raster.height; y += 1) {
		for (let x = 0; x < target.width; x += 1) {
			const out = (y * target.width + x) * COLOUR_CHANNELS
			for (let channel = 0; channel < COLOUR_CHANNELS; channel += 1) {
				let linear = 0
				for (const { source, share } of columns[x] ?? []) {
					linear += (LINEAR_OF[raster.data[(y * raster.width + source) * CHANNELS + channel] ?? 0] ?? 0) * share
				}
				horizontal[out + channel] = linear
			}
		}
	}
	const data = new Uint8Array(target.width * target.height * CHANNELS)
	for (let y = 0; y < target.height; y += 1) {
		for (let x = 0; x < target.width; x += 1) {
			const out = (y * target.width + x) * CHANNELS
			for (let channel = 0; channel < COLOUR_CHANNELS; channel += 1) {
				let linear = 0
				for (const { source, share } of rows[y] ?? []) {
					linear += (horizontal[(source * target.width + x) * COLOUR_CHANNELS + channel] ?? 0) * share
				}
				data[out + channel] = ENCODED_OF[Math.round(Math.min(1, Math.max(0, linear)) * LINEAR_STEPS)] ?? 0
			}
			data[out + COLOUR_CHANNELS] = OPAQUE
		}
	}
	return { ...target, data }
}

function isTurned(orientation: Orientation): boolean {
	return orientation >= ORIENTATION.TRANSPOSED
}

function sourceOf(x: number, y: number, raster: Raster, orientation: Orientation): number {
	const right = raster.width - 1
	const bottom = raster.height - 1
	switch (orientation) {
		case ORIENTATION.NORMAL:
			return y * raster.width + x
		case ORIENTATION.MIRRORED:
			return y * raster.width + (right - x)
		case ORIENTATION.ROTATED_180:
			return (bottom - y) * raster.width + (right - x)
		case ORIENTATION.FLIPPED:
			return (bottom - y) * raster.width + x
		case ORIENTATION.TRANSPOSED:
			return x * raster.width + y
		case ORIENTATION.ROTATED_90:
			return (bottom - x) * raster.width + y
		case ORIENTATION.TRANSVERSED:
			return (bottom - x) * raster.width + (right - y)
		case ORIENTATION.ROTATED_270:
			return x * raster.width + (right - y)
		default:
			return orientation satisfies never
	}
}

// CAP-021-R40, EXIF 2.3 4.6.4
export function upright(raster: Raster, orientation: Orientation): Raster {
	if (orientation === ORIENTATION.NORMAL) {
		return raster
	}
	const width = isTurned(orientation) ? raster.height : raster.width
	const height = isTurned(orientation) ? raster.width : raster.height
	const data = new Uint8Array(width * height * CHANNELS)
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const input = sourceOf(x, y, raster, orientation) * CHANNELS
			data.set(raster.data.subarray(input, input + CHANNELS), (y * width + x) * CHANNELS)
		}
	}
	return { width, height, data }
}
