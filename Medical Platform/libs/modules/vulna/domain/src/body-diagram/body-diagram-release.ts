import { type BodyView, type DiagramArea, type DiagramFrame, pointsOf, type SilhouettePath } from "@ansora/contracts"
import type { BodyDiagramRegion } from "./body-diagram-region"
import type { BodySurface } from "./body-surface"

export interface ReleaseArea extends DiagramArea {
	surface: BodySurface
}

export interface ReleaseView {
	frame: DiagramFrame
	silhouette: readonly SilhouettePath[]
	areas: readonly ReleaseArea[]
}

// CAP-016-R07, CAP-016-R08, ADR-023
export interface BodyDiagramRelease {
	version: string
	regions: readonly BodyDiagramRegion[]
	views: Readonly<Partial<Record<BodyView, ReleaseView>>>
}

export function releaseArea(regionCode: string, surface: BodySurface, points: string): ReleaseArea {
	return { regionCode, surface, points: pointsOf(points) }
}
