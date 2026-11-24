import { type BodyView, type DiagramPoint, isInsidePolygon, regionCodeAt } from "@ansora/contracts"
import { BODY_DIAGRAM_1 } from "./body-diagram-1"
import { BODY_DIAGRAM_2 } from "./body-diagram-2"
import type { BodyDiagramRegion } from "./body-diagram-region"
import type { BodyDiagramRelease } from "./body-diagram-release"
import type { BodySurface } from "./body-surface"

// CAP-016-R07, CAP-016-R08
export const BODY_DIAGRAM_RELEASES: readonly BodyDiagramRelease[] = [BODY_DIAGRAM_1, BODY_DIAGRAM_2]

export const CURRENT_BODY_DIAGRAM = BODY_DIAGRAM_2

export function bodyDiagramRelease(version: string): BodyDiagramRelease | undefined {
	return BODY_DIAGRAM_RELEASES.find((release) => release.version === version)
}

export function bodyDiagramRegion(release: BodyDiagramRelease, code: string): BodyDiagramRegion | undefined {
	return release.regions.find((region) => region.code === code)
}

// CAP-016-R06, CAP-016-S02
export function bodyDiagramRegionAt(
	release: BodyDiagramRelease,
	view: BodyView,
	point: DiagramPoint,
): BodyDiagramRegion | undefined {
	const drawn = release.views[view]
	const code = drawn === undefined ? undefined : regionCodeAt(drawn, point)
	return code === undefined ? undefined : bodyDiagramRegion(release, code)
}

// CAP-016-R20, CAP-016-S15, Q-146
export function bodySurfaceAt(
	release: BodyDiagramRelease,
	view: BodyView,
	point: DiagramPoint,
): BodySurface | undefined {
	return release.views[view]?.areas.find((area) => isInsidePolygon(area.points, point))?.surface
}
