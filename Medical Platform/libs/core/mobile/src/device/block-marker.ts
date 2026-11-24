import { isIsoMoment } from "./moment"

// CAP-006-R19, CAP-008-R06, zarizeni-a-sifrovani.md 1.1
export interface BlockMarker {
	predecessorHwId: string
	detectedAt: string
}

export interface BlockMarkerStore {
	read(): Promise<BlockMarker | undefined>
	write(marker: BlockMarker): Promise<void>
	clear(): Promise<void>
}

// CAP-006-R19
export function blockMarkerOf(stored: string | null): BlockMarker | undefined {
	if (stored === null) {
		return undefined
	}
	try {
		const parsed: unknown = JSON.parse(stored)
		return isBlockMarker(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function isBlockMarker(value: unknown): value is BlockMarker {
	if (typeof value !== "object" || value === null) {
		return false
	}
	const marker = value as Partial<BlockMarker>
	return (
		typeof marker.predecessorHwId === "string" && marker.predecessorHwId.length > 0 && isIsoMoment(marker.detectedAt)
	)
}
