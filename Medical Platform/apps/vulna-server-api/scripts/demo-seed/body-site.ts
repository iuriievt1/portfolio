import { type BodyView, type Laterality, normalizedPointInRegion } from "@ansora/contracts"
import { type BodySite, bodySiteProblemOf, CURRENT_BODY_DIAGRAM } from "@ansora/vulna-domain"

const COORDINATE_PRECISION = 10_000

function rounded(coordinate: number): number {
	return Math.round(coordinate * COORDINATE_PRECISION) / COORDINATE_PRECISION
}

// CAP-016-R06, CAP-016-R11, CAP-016-R16
export function bodySiteIn(regionCode: string, view: BodyView, laterality: Laterality | null): BodySite {
	const drawn = CURRENT_BODY_DIAGRAM.views[view]
	if (drawn === undefined) {
		throw new Error(`the body diagram ${CURRENT_BODY_DIAGRAM.version} draws no ${view} view`)
	}
	const point = normalizedPointInRegion(view, drawn, regionCode, laterality)
	if (point === undefined) {
		throw new Error(`no point of region ${regionCode} lies in the ${view} view on side ${laterality ?? "none"}`)
	}
	const site: BodySite = {
		regionCode,
		laterality,
		view,
		x: rounded(point.x),
		y: rounded(point.y),
		bodyDiagramVersion: CURRENT_BODY_DIAGRAM.version,
	}
	const problem = bodySiteProblemOf(site)
	if (problem !== undefined) {
		throw new Error(`the demo site of region ${regionCode} in the ${view} view is invalid: ${problem}`)
	}
	return site
}
