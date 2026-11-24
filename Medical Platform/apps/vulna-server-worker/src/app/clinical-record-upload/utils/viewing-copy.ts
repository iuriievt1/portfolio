import { decode, encode } from "jpeg-js"
import { metadataOf, withSegments } from "./jpeg-segments"
import { downscaled, upright } from "./raster"

// CVE-2020-8175
const MAX_RESOLUTION_MP = 100
const MAX_MEMORY_MB = 512

export interface ViewingCopySettings {
	maxLongEdgePx: number
	quality: number
}

// CAP-021-R40, ADR-050 bod 13, konfigurace-a-profily.md 2.1
export function viewingCopyOf(original: Uint8Array, settings: ViewingCopySettings): Buffer {
	const metadata = metadataOf(original)
	const decoded = decode(original, {
		useTArray: true,
		formatAsRGBA: true,
		maxResolutionInMP: MAX_RESOLUTION_MP,
		maxMemoryUsageInMB: MAX_MEMORY_MB,
	})
	const copy = upright(downscaled(decoded, settings.maxLongEdgePx), metadata.orientation)
	return withSegments(encode(copy, settings.quality).data, metadata.iccSegments)
}
