import { type BodyDiagramDrawing, type BodyView, type DiagramPoint, siteOnDrawing } from "@ansora/contracts"
import type { BodySite, Finding } from "../../api/findings"
import sizes from "../../styles/sizes.json"
import { clamp } from "../../utils/clamp"

// clinical-workflow.yaml bodyDiagramBackground, DESIGN.md 12.2
export const MARKER_SIZE = sizes.mark
export const MARKER_HIT_SLOP = 8
export const MAX_MAP_SCALE = 1.05
export const DESCRIPTION_GAP = 4
export const PHOTO_ROW_RESERVE = sizes.thumbnail + sizes["thumbnail-gap"]
export const MAP_MIN_HEIGHT_SHARE = 0.4
export const SPOT_RADIUS = 3
export const SPOT_RING_WIDTH = 1.5
export const GUIDE_WIDTH = 1
const MARKER_RADIUS = MARKER_SIZE / 2
const MARKER_REACH = MARKER_RADIUS + MARKER_HIT_SLOP
const MARKER_GAP = 4
const MARKER_SPACING = MARKER_SIZE + MARKER_GAP
const RING_STEP = MARKER_RADIUS
const RING_COUNT = 6
const RING_DIRECTIONS = 16
const PLACEMENT_TOLERANCE = 0.001

export interface Area {
	width: number
	height: number
}

export interface MapBox extends Area {
	scale: number
}

export interface MarkerPlacement {
	spot: DiagramPoint
	centre: DiagramPoint
	isDisplaced: boolean
}

export interface Placement {
	x: number
	y: number
	width: number
	height: number
}

// clinical-workflow.yaml bodyDiagramBackground
export function fitBox(area: Area, drawing: Area): MapBox {
	const scale = Math.min(area.width / drawing.width, area.height / drawing.height, MAX_MAP_SCALE)
	return { width: drawing.width * scale, height: drawing.height * scale, scale }
}

// CAP-016-R17
export function mapRegionOf(area: Area, descriptionHeight: number): Area {
	if (descriptionHeight <= 0) {
		return area
	}
	const remaining = area.height - descriptionHeight - DESCRIPTION_GAP
	return { width: area.width, height: Math.max(remaining, area.height * MAP_MIN_HEIGHT_SHARE) }
}

// CAP-016-R17, CAP-015-R32
export function oneViewReserveOf(descriptionHeight: number, hasPhotoRow: boolean): number {
	return hasPhotoRow ? descriptionHeight : descriptionHeight + PHOTO_ROW_RESERVE
}

// CAP-016-R17
export function placementOfBox(region: Area, box: MapBox): Placement {
	return {
		x: (region.width - box.width) / 2,
		y: (region.height - box.height) / 2,
		width: box.width,
		height: box.height,
	}
}

// CAP-016-R17, CAP-016-R04
export function drawingOfView(drawing: BodyDiagramDrawing, view: BodyView): BodyDiagramDrawing | undefined {
	const drawn = drawing.views[view]
	if (drawn === undefined) {
		return undefined
	}
	const frame = { x: 0, y: 0, width: drawn.frame.width, height: drawn.frame.height }
	return { version: drawing.version, views: { [view]: { ...drawn, frame } } }
}

// CAP-016-R17, DESIGN.md 12.2
export function placeMarkers(spots: readonly DiagramPoint[], box: MapBox): readonly MarkerPlacement[] {
	const placed: MarkerPlacement[] = []
	for (const spot of spots) {
		const onScreen = { x: spot.x * box.scale, y: spot.y * box.scale }
		const isFree = (candidate: DiagramPoint) =>
			placed.every((other) => distanceBetween(other.centre, candidate) >= MARKER_SPACING - PLACEMENT_TOLERANCE)
		const centre = candidatesAround(onScreen, box).find(isFree) ?? insideMap(onScreen, box)
		placed.push({ spot: onScreen, centre, isDisplaced: distanceBetween(centre, onScreen) > MARKER_RADIUS })
	}
	return placed
}

function candidatesAround(spot: DiagramPoint, box: MapBox): DiagramPoint[] {
	const candidates = [insideMap(spot, box)]
	for (let ring = 1; ring <= RING_COUNT; ring++) {
		for (let step = 0; step < RING_DIRECTIONS; step++) {
			const angle = -Math.PI / 2 + (2 * Math.PI * step) / RING_DIRECTIONS
			const reach = ring * RING_STEP
			candidates.push(insideMap({ x: spot.x + reach * Math.cos(angle), y: spot.y + reach * Math.sin(angle) }, box))
		}
	}
	return candidates
}

function insideMap(point: DiagramPoint, box: MapBox): DiagramPoint {
	return {
		x: clamp(point.x, MARKER_RADIUS, box.width - MARKER_RADIUS),
		y: clamp(point.y, MARKER_RADIUS, box.height - MARKER_RADIUS),
	}
}

function distanceBetween(first: DiagramPoint, second: DiagramPoint): number {
	return Math.hypot(first.x - second.x, first.y - second.y)
}

export interface LocatedFinding {
	finding: Finding
	bodySite: BodySite
}

export interface PlacedWound extends LocatedFinding {
	spot: DiagramPoint
}

// NAB-179, CAP-016-R04, CAP-016-R08
export function spotOf(drawing: BodyDiagramDrawing, bodySite: BodySite): DiagramPoint | undefined {
	const view = drawing.views[bodySite.view]
	if (view === undefined || bodySite.body_diagram_version !== drawing.version) {
		return undefined
	}
	const { x, y, width, height } = view.frame
	return { x: x + bodySite.x * width, y: y + bodySite.y * height }
}

// DESIGN.md 12.2, CAP-016-R17, CAP-016-R08, CAP-020-R23
export function locatedFindings(findings: readonly Finding[], drawing: BodyDiagramDrawing): readonly LocatedFinding[] {
	return findings
		.flatMap((finding) => {
			const recorded = finding.last_body_site
			return recorded === undefined ? [] : [{ finding, bodySite: siteOnDrawing(drawing, recorded) ?? recorded }]
		})
		.sort((left, right) => left.finding.number - right.finding.number)
}

// CAP-016-R17, CAP-016-R08
export function placedWounds(drawing: BodyDiagramDrawing, wounds: readonly LocatedFinding[]): readonly PlacedWound[] {
	return wounds.flatMap((wound) => {
		const spot = spotOf(drawing, wound.bodySite)
		return spot === undefined ? [] : [{ ...wound, spot }]
	})
}

// CAP-016-R17
export function woundAt(point: DiagramPoint, wounds: readonly PlacedWound[], scale: number): PlacedWound | undefined {
	return wounds
		.map((wound) => ({ wound, distance: distanceBetween(wound.spot, point) * scale }))
		.filter(({ distance }) => distance <= MARKER_REACH)
		.sort((first, second) => first.distance - second.distance)
		.at(0)?.wound
}
