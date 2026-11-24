export interface PreviewSize {
	width: number
	height: number
}

// CAP-015-R10
export function previewSizeOf(width: number, height: number, longestSide: number): PreviewSize {
	const scale = Math.min(1, longestSide / Math.max(width, height))
	return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
