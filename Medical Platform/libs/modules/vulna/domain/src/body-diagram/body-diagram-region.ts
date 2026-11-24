import type { BodyView } from "@ansora/contracts"

export interface DicomRegionCode {
	code: string
	meaning: string
}

// CAP-016-R03, CAP-016-R09, CAP-016-R10, CAP-016-R18
export interface BodyDiagramRegion {
	code: string
	names: Readonly<Record<string, string>>
	isPaired: boolean
	views: readonly BodyView[]
	dicomRegion: DicomRegionCode
}
