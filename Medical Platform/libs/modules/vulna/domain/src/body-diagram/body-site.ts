import { type BodyView, canvasPoint, type Laterality, lateralityAt } from "@ansora/contracts"
import { bodyDiagramRegion, bodyDiagramRegionAt, bodyDiagramRelease, bodySurfaceAt } from "./body-diagram"
import type { BodyDiagramRegion } from "./body-diagram-region"
import type { BodySurface } from "./body-surface"

// CAP-016-R03, CAP-016-R04, CAP-016-R08, CAP-016-R16
export interface BodySite {
	regionCode: string
	laterality: Laterality | null
	view: BodyView
	x: number
	y: number
	bodyDiagramVersion: string
}

export const BODY_SITE_PROBLEM = {
	UNKNOWN_VERSION: "unknown_version",
	UNKNOWN_REGION: "unknown_region",
	REGION_NOT_IN_VIEW: "region_not_in_view",
	POINT_OUTSIDE_REGION: "point_outside_region",
	WRONG_LATERALITY: "wrong_laterality",
} as const

export type BodySiteProblem = (typeof BODY_SITE_PROBLEM)[keyof typeof BODY_SITE_PROBLEM]

// CAP-016-R08
export function bodySiteRegionOf(site: BodySite): BodyDiagramRegion | undefined {
	const release = bodyDiagramRelease(site.bodyDiagramVersion)
	return release === undefined ? undefined : bodyDiagramRegion(release, site.regionCode)
}

// CAP-016-R06, CAP-016-R11, CAP-016-R16, CAP-016-S02
export function bodySiteProblemOf(site: BodySite): BodySiteProblem | undefined {
	const release = bodyDiagramRelease(site.bodyDiagramVersion)
	if (release === undefined) {
		return BODY_SITE_PROBLEM.UNKNOWN_VERSION
	}
	const region = bodyDiagramRegion(release, site.regionCode)
	if (region === undefined) {
		return BODY_SITE_PROBLEM.UNKNOWN_REGION
	}
	const drawn = release.views[site.view]
	if (!region.views.includes(site.view) || drawn === undefined) {
		return BODY_SITE_PROBLEM.REGION_NOT_IN_VIEW
	}
	if (bodyDiagramRegionAt(release, site.view, canvasPoint(drawn.frame, site))?.code !== region.code) {
		return BODY_SITE_PROBLEM.POINT_OUTSIDE_REGION
	}
	const laterality = region.isPaired ? lateralityAt(site.view, site) : null
	return site.laterality === laterality ? undefined : BODY_SITE_PROBLEM.WRONG_LATERALITY
}

// CAP-016-R20, Q-146
export function drawnBodySurfaceOf(site: BodySite): BodySurface | undefined {
	const release = bodyDiagramRelease(site.bodyDiagramVersion)
	const drawn = release?.views[site.view]
	return release === undefined || drawn === undefined
		? undefined
		: bodySurfaceAt(release, site.view, canvasPoint(drawn.frame, site))
}

// CAP-016-R20, Q-146
export function bodySurfaceOf(site: BodySite): BodySurface {
	const surface = drawnBodySurfaceOf(site)
	if (surface === undefined) {
		throw new Error(`the body site ${site.regionCode} of version ${site.bodyDiagramVersion} has no anatomic surface`)
	}
	return surface
}
