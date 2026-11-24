import {
	type BodyDiagramDrawing,
	type BodyView,
	type DiagramPoint,
	lateralityAt,
	normalizedPoint,
	regionCodeAt,
	viewPointAt,
} from "@ansora/contracts"
import type { BodyDiagramRegion } from "../../api/code-lists"
import type { BodySite } from "../../api/findings"

// CAP-016-R03, CAP-016-R04, CAP-016-R06, CAP-016-R11, CAP-016-R16, CAP-016-S02
export function bodySiteOfTouch(
	drawing: BodyDiagramDrawing,
	regions: readonly BodyDiagramRegion[],
	point: DiagramPoint,
): BodySite | undefined {
	const touched = viewPointAt(drawing.views, point)
	return touched === undefined ? undefined : bodySiteInView(drawing, regions, touched.view, touched.point)
}

function bodySiteInView(
	drawing: BodyDiagramDrawing,
	regions: readonly BodyDiagramRegion[],
	view: BodyView,
	touch: DiagramPoint,
): BodySite | undefined {
	const drawn = drawing.views[view]
	const code = drawn === undefined ? undefined : regionCodeAt(drawn, touch)
	const region = regions.find((candidate) => candidate.code === code)
	if (drawn === undefined || region === undefined) {
		return undefined
	}
	const normalized = normalizedPoint(drawn.frame, touch)
	return {
		region_code: region.code,
		laterality: region.is_paired ? lateralityAt(view, normalized) : null,
		view,
		x: normalized.x,
		y: normalized.y,
		body_diagram_version: drawing.version,
	}
}
