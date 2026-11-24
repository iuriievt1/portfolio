import {
	type BodyDiagramDrawing,
	BodyDiagramFormatError,
	type DiagramFrame,
	type DiagramPoint,
	type DiagramView,
	type DiagramViews,
	drawnViews,
	SILHOUETTE_PART,
} from "./body-diagram"
import { BODY_VIEW, type BodyView, LATERALITY, type Laterality } from "./clinical"
import type { components } from "./generated/mobile"

type BodySite = components["schemas"]["BodySite"]

const CURVE_SEGMENTS = 12
const PATH_TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g
const COMMAND = /^[A-Za-z]$/
const HALF = 0.5
const REGION_GRID_STEPS = 24

interface Outline {
	points: readonly DiagramPoint[]
	left: number
	right: number
	top: number
	bottom: number
}

interface ViewPoint {
	view: BodyView
	point: DiagramPoint
}

const outlines = new WeakMap<DiagramView, readonly (readonly Outline[])[]>()

// CAP-016-R04, NAB-179
export function normalizedPoint(frame: DiagramFrame, point: DiagramPoint): DiagramPoint {
	return { x: point.x / frame.width, y: point.y / frame.height }
}

export function canvasPoint(frame: DiagramFrame, normalized: DiagramPoint): DiagramPoint {
	return { x: normalized.x * frame.width, y: normalized.y * frame.height }
}

// CAP-016-R04, CAP-016-S02
export function viewPointAt(views: DiagramViews, point: DiagramPoint): ViewPoint | undefined {
	for (const [view, drawn] of drawnViews(views)) {
		const { x, y, width, height } = drawn.frame
		const local = { x: point.x - x, y: point.y - y }
		const isInFrame = local.x >= 0 && local.y >= 0 && local.x <= width && local.y <= height
		if (isInFrame && isOnSilhouette(drawn, local)) {
			return { view, point: local }
		}
	}
	return undefined
}

// CAP-016-R06, CAP-016-R15, CAP-016-S02
export function regionCodeAt(view: DiagramView, point: DiagramPoint): string | undefined {
	if (!isOnSilhouette(view, point)) {
		return undefined
	}
	return view.areas.find((area) => isInsidePolygon(area.points, point))?.regionCode
}

// CAP-016-R16, CAP-016-S07, CAP-016-S08, clinical-workflow.yaml BodyView
export function lateralityAt(view: BodyView, normalized: DiagramPoint): Laterality {
	const isOnLeftHalf = normalized.x < HALF
	switch (view) {
		case BODY_VIEW.ANTERIOR:
		case BODY_VIEW.PLANTAR:
			return isOnLeftHalf ? LATERALITY.RIGHT : LATERALITY.LEFT
		case BODY_VIEW.POSTERIOR:
		case BODY_VIEW.DORSAL:
			return isOnLeftHalf ? LATERALITY.LEFT : LATERALITY.RIGHT
		case BODY_VIEW.RIGHT_LATERAL:
			return LATERALITY.RIGHT
		case BODY_VIEW.LEFT_LATERAL:
			return LATERALITY.LEFT
		default:
			return view satisfies never
	}
}

// CAP-016-R08, CAP-016-R17
export function siteOnDrawing(drawing: BodyDiagramDrawing, site: BodySite): BodySite | undefined {
	if (site.body_diagram_version === drawing.version) {
		return site
	}
	const drawn = drawing.views[site.view]
	const point =
		drawn === undefined ? undefined : normalizedPointInRegion(site.view, drawn, site.region_code, site.laterality)
	return point === undefined ? undefined : { ...site, x: point.x, y: point.y, body_diagram_version: drawing.version }
}

// CAP-016-R08, CAP-016-R16, CAP-016-R17
export function normalizedPointInRegion(
	view: BodyView,
	drawn: DiagramView,
	regionCode: string,
	laterality: Laterality | null,
): DiagramPoint | undefined {
	const isOnSide = (normalized: DiagramPoint) => laterality === null || lateralityAt(view, normalized) === laterality
	const isInRegion = (normalized: DiagramPoint) =>
		regionCodeAt(drawn, canvasPoint(drawn.frame, normalized)) === regionCode
	for (const area of drawn.areas.filter((candidate) => candidate.regionCode === regionCode)) {
		const found = candidatesIn(area.points)
			.map((point) => normalizedPoint(drawn.frame, point))
			.find((normalized) => isOnSide(normalized) && isInRegion(normalized))
		if (found !== undefined) {
			return found
		}
	}
	return undefined
}

function candidatesIn(points: readonly DiagramPoint[]): DiagramPoint[] {
	const centre = centroidOf(points)
	const grid = gridOver(points).sort(
		(first, second) => squaredDistance(first, centre) - squaredDistance(second, centre),
	)
	return [centre, ...grid]
}

function centroidOf(points: readonly DiagramPoint[]): DiagramPoint {
	const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), { x: 0, y: 0 })
	return { x: sum.x / points.length, y: sum.y / points.length }
}

function gridOver(points: readonly DiagramPoint[]): DiagramPoint[] {
	const { left, right, top, bottom } = outlineOf(points)
	const grid: DiagramPoint[] = []
	for (let row = 0; row <= REGION_GRID_STEPS; row++) {
		for (let column = 0; column <= REGION_GRID_STEPS; column++) {
			grid.push({
				x: left + ((right - left) * column) / REGION_GRID_STEPS,
				y: top + ((bottom - top) * row) / REGION_GRID_STEPS,
			})
		}
	}
	return grid
}

function squaredDistance(first: DiagramPoint, second: DiagramPoint): number {
	const across = first.x - second.x
	const down = first.y - second.y
	return across * across + down * down
}

export function isOnSilhouette(view: DiagramView, point: DiagramPoint): boolean {
	return fillOutlinesOf(view).some((subpaths) => windingNumber(subpaths, point) !== 0)
}

export function isInsidePolygon(points: readonly DiagramPoint[], point: DiagramPoint): boolean {
	let isInside = false
	let start = points.at(-1)
	for (const end of points) {
		if (start !== undefined && start.y > point.y !== end.y > point.y) {
			const crossingX = ((end.x - start.x) * (point.y - start.y)) / (end.y - start.y) + start.x
			if (point.x < crossingX) {
				isInside = !isInside
			}
		}
		start = end
	}
	return isInside
}

function fillOutlinesOf(view: DiagramView): readonly (readonly Outline[])[] {
	const cached = outlines.get(view)
	if (cached !== undefined) {
		return cached
	}
	const flattened = view.silhouette
		.filter((part) => part.part === SILHOUETTE_PART.FILL)
		.map((part) => subpathsOf(part.path).map(outlineOf))
	outlines.set(view, flattened)
	return flattened
}

function outlineOf(points: readonly DiagramPoint[]): Outline {
	const xs = points.map((point) => point.x)
	const ys = points.map((point) => point.y)
	return { points, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
}

function windingNumber(subpaths: readonly Outline[], point: DiagramPoint): number {
	let winding = 0
	for (const outline of subpaths) {
		if (point.x < outline.left || point.x > outline.right || point.y < outline.top || point.y > outline.bottom) {
			continue
		}
		let start = outline.points.at(-1)
		for (const end of outline.points) {
			if (start !== undefined) {
				winding += crossing(start, end, point)
			}
			start = end
		}
	}
	return winding
}

function crossing(start: DiagramPoint, end: DiagramPoint, point: DiagramPoint): number {
	const side = (end.x - start.x) * (point.y - start.y) - (point.x - start.x) * (end.y - start.y)
	if (start.y <= point.y && end.y > point.y && side > 0) {
		return 1
	}
	if (start.y > point.y && end.y <= point.y && side < 0) {
		return -1
	}
	return 0
}

// SVG 1.1 8.3
export function subpathsOf(path: string): DiagramPoint[][] {
	const tokens = path.match(PATH_TOKEN) ?? []
	const subpaths: DiagramPoint[][] = []
	let current: DiagramPoint[] = []
	let pen: DiagramPoint = { x: 0, y: 0 }
	let command = ""
	let index = 0
	const number = (): number => {
		const token = tokens[index++]
		if (token === undefined || COMMAND.test(token)) {
			throw new BodyDiagramFormatError("a silhouette path is cut short")
		}
		return Number(token)
	}
	const finish = () => {
		if (current.length > 1) {
			subpaths.push(current)
		}
		current = []
	}
	while (index < tokens.length) {
		const token = tokens[index]
		if (token !== undefined && COMMAND.test(token)) {
			command = token
			index += 1
		}
		switch (command) {
			case "M":
				finish()
				pen = { x: number(), y: number() }
				current.push(pen)
				command = "L"
				break
			case "L":
				pen = { x: number(), y: number() }
				current.push(pen)
				break
			case "H":
				pen = { x: number(), y: pen.y }
				current.push(pen)
				break
			case "V":
				pen = { x: pen.x, y: number() }
				current.push(pen)
				break
			case "C": {
				const first = { x: number(), y: number() }
				const second = { x: number(), y: number() }
				const end = { x: number(), y: number() }
				current.push(...cubicPoints(pen, first, second, end))
				pen = end
				break
			}
			case "Z":
				finish()
				command = ""
				break
			default:
				throw new BodyDiagramFormatError(`a silhouette path uses the unsupported command ${command}`)
		}
	}
	finish()
	return subpaths
}

function cubicPoints(
	start: DiagramPoint,
	first: DiagramPoint,
	second: DiagramPoint,
	end: DiagramPoint,
): DiagramPoint[] {
	const points: DiagramPoint[] = []
	for (let step = 1; step <= CURVE_SEGMENTS; step++) {
		const progress = step / CURVE_SEGMENTS
		const remaining = 1 - progress
		const startWeight = remaining ** 3
		const firstWeight = 3 * remaining ** 2 * progress
		const secondWeight = 3 * remaining * progress ** 2
		const endWeight = progress ** 3
		points.push({
			x: startWeight * start.x + firstWeight * first.x + secondWeight * second.x + endWeight * end.x,
			y: startWeight * start.y + firstWeight * first.y + secondWeight * second.y + endWeight * end.y,
		})
	}
	return points
}
