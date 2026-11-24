import { BODY_VIEWS, type BodyView } from "./clinical"

export const SILHOUETTE_PART = {
	FILL: "fill",
	OUTLINE: "outline",
	DETAIL: "detail",
} as const

export type SilhouettePart = (typeof SILHOUETTE_PART)[keyof typeof SILHOUETTE_PART]

export interface DiagramPoint {
	x: number
	y: number
}

// getBodyDiagramBackground, CAP-016-R04
export interface DiagramFrame {
	x: number
	y: number
	width: number
	height: number
}

export interface SilhouettePath {
	part: SilhouettePart
	path: string
}

export interface DiagramArea {
	regionCode: string
	points: readonly DiagramPoint[]
}

export interface DiagramView {
	frame: DiagramFrame
	silhouette: readonly SilhouettePath[]
	areas: readonly DiagramArea[]
}

export type DiagramViews = Readonly<Partial<Record<BodyView, DiagramView>>>

export interface BodyDiagramDrawing {
	version: string
	views: DiagramViews
}

export class BodyDiagramFormatError extends Error {}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg"

const ELEMENT = {
	SVG: "svg",
	PATH: "path",
	POLYGON: "polygon",
} as const

const ATTRIBUTE = {
	VERSION: "data-body-diagram-version",
	VIEW: "data-view",
	PART: "data-part",
	REGION: "data-region",
	PATH: "d",
	POINTS: "points",
	X: "x",
	Y: "y",
	WIDTH: "width",
	HEIGHT: "height",
	VIEW_BOX: "viewBox",
} as const

// Figma 561:1939
export const SILHOUETTE_OUTLINE = {
	WIDTH: 1.256,
	MITER_LIMIT: 2.5,
} as const

const PART_PAINT: Record<SilhouettePart, string> = {
	[SILHOUETTE_PART.FILL]: 'fill="#FFFFFF"',
	[SILHOUETTE_PART.OUTLINE]: `fill="none" stroke="#0A0A0A" stroke-width="${SILHOUETTE_OUTLINE.WIDTH}" stroke-miterlimit="${SILHOUETTE_OUTLINE.MITER_LIMIT}"`,
	[SILHOUETTE_PART.DETAIL]: 'fill="#0A0A0A"',
}

const TAG = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"<>]*")*)\s*(\/?)>/g
const ATTRIBUTE_PAIR = /([a-zA-Z:-]+)="([^"<>]*)"/g
const POINT_SEPARATOR = ","
const WHITESPACE = /\s+/

export function drawnViews(views: DiagramViews): readonly (readonly [BodyView, DiagramView])[] {
	return BODY_VIEWS.flatMap((view) => {
		const drawn = views[view]
		return drawn === undefined ? [] : [[view, drawn] as const]
	})
}

// getBodyDiagramBackground
export function drawingSize(views: DiagramViews): { width: number; height: number } {
	const frames = drawnViews(views).map(([, drawn]) => drawn.frame)
	if (frames.length === 0) {
		throw new BodyDiagramFormatError("the body diagram has no view")
	}
	return {
		width: Math.max(...frames.map((frame) => frame.x + frame.width)),
		height: Math.max(...frames.map((frame) => frame.y + frame.height)),
	}
}

// getBodyDiagramBackground, CAP-016-R03, CAP-016-R04
export function bodyDiagramSvg(drawing: BodyDiagramDrawing): string {
	const { width, height } = drawingSize(drawing.views)
	const views = drawnViews(drawing.views).map(([view, drawn]) => viewSvg(view, drawn))
	return [
		`<svg xmlns="${SVG_NAMESPACE}" viewBox="0 0 ${width} ${height}" ${ATTRIBUTE.VERSION}="${drawing.version}">`,
		...views,
		"</svg>",
		"",
	].join("\n")
}

function viewSvg(view: BodyView, drawing: DiagramView): string {
	const { x, y, width, height } = drawing.frame
	const silhouette = drawing.silhouette.map(
		(part) => `<path ${ATTRIBUTE.PART}="${part.part}" ${ATTRIBUTE.PATH}="${part.path}" ${PART_PAINT[part.part]}/>`,
	)
	const areas = drawing.areas.map(
		(area) =>
			`<polygon ${ATTRIBUTE.REGION}="${area.regionCode}" ${ATTRIBUTE.POINTS}="${pointsText(area.points)}" fill="none"/>`,
	)
	return [
		`<svg ${ATTRIBUTE.VIEW}="${view}" x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBoxOf(width, height)}">`,
		...silhouette,
		...areas,
		"</svg>",
	].join("\n")
}

function viewBoxOf(width: number, height: number): string {
	return `0 0 ${width} ${height}`
}

function pointsText(points: readonly DiagramPoint[]): string {
	return points.map((point) => `${point.x}${POINT_SEPARATOR}${point.y}`).join(" ")
}

interface Element {
	name: string
	attributes: ReadonlyMap<string, string>
}

interface ViewInProgress {
	view: BodyView
	frame: DiagramFrame
	silhouette: SilhouettePath[]
	areas: DiagramArea[]
}

// getBodyDiagramBackground
export function readBodyDiagramSvg(svg: string): BodyDiagramDrawing {
	const views: Partial<Record<BodyView, DiagramView>> = {}
	let version: string | undefined
	let current: ViewInProgress | undefined
	let depth = 0
	for (const { element, isClosing, isSelfClosing } of tagsOf(svg)) {
		if (isClosing) {
			if (depth === 2 && current !== undefined) {
				views[current.view] = { frame: current.frame, silhouette: current.silhouette, areas: current.areas }
				current = undefined
			}
			depth -= 1
			continue
		}
		if (depth === 0) {
			version = rootVersion(element)
		} else if (depth === 1) {
			current = openView(element, views)
		} else if (current === undefined) {
			throw new BodyDiagramFormatError(`unexpected <${element.name}>`)
		} else {
			readViewChild(element, current)
		}
		if (!isSelfClosing) {
			depth += 1
		}
	}
	if (version === undefined || depth !== 0 || drawnViews(views).length === 0) {
		throw new BodyDiagramFormatError("the body diagram is incomplete")
	}
	return { version, views }
}

function* tagsOf(svg: string): Generator<{ element: Element; isClosing: boolean; isSelfClosing: boolean }> {
	let position = 0
	for (const match of svg.matchAll(TAG)) {
		expectWhitespace(svg.slice(position, match.index))
		position = match.index + match[0].length
		const [, closing, name = "", attributes = "", selfClosing] = match
		yield {
			element: { name, attributes: attributesOf(attributes) },
			isClosing: closing === "/",
			isSelfClosing: selfClosing === "/",
		}
	}
	expectWhitespace(svg.slice(position))
}

function expectWhitespace(text: string): void {
	if (text.trim() !== "") {
		throw new BodyDiagramFormatError("the body diagram carries content outside its elements")
	}
}

function attributesOf(text: string): ReadonlyMap<string, string> {
	return new Map([...text.matchAll(ATTRIBUTE_PAIR)].map(([, name = "", value = ""]) => [name, value]))
}

function rootVersion(element: Element): string {
	const version = element.attributes.get(ATTRIBUTE.VERSION)
	if (element.name !== ELEMENT.SVG || version === undefined || version === "") {
		throw new BodyDiagramFormatError("the body diagram names no version")
	}
	return version
}

function openView(element: Element, views: Partial<Record<BodyView, DiagramView>>): ViewInProgress {
	const view = BODY_VIEWS.find((candidate) => candidate === element.attributes.get(ATTRIBUTE.VIEW))
	if (element.name !== ELEMENT.SVG || view === undefined || views[view] !== undefined) {
		throw new BodyDiagramFormatError("the body diagram has an unknown or repeated view")
	}
	return { view, frame: frameOf(element), silhouette: [], areas: [] }
}

function frameOf(element: Element): DiagramFrame {
	const frame = {
		x: numberOf(element, ATTRIBUTE.X),
		y: numberOf(element, ATTRIBUTE.Y),
		width: numberOf(element, ATTRIBUTE.WIDTH),
		height: numberOf(element, ATTRIBUTE.HEIGHT),
	}
	const isPlaced = frame.x >= 0 && frame.y >= 0 && frame.width > 0 && frame.height > 0
	if (!isPlaced || element.attributes.get(ATTRIBUTE.VIEW_BOX) !== viewBoxOf(frame.width, frame.height)) {
		throw new BodyDiagramFormatError("a view of the body diagram has no valid frame")
	}
	return frame
}

function numberOf(element: Element, attribute: string): number {
	const value = Number(required(element, attribute))
	if (!Number.isFinite(value)) {
		throw new BodyDiagramFormatError(`<${element.name}> has a malformed ${attribute}`)
	}
	return value
}

function readViewChild(element: Element, view: ViewInProgress): void {
	if (element.name === ELEMENT.PATH) {
		view.silhouette.push({ part: partOf(element), path: required(element, ATTRIBUTE.PATH) })
		return
	}
	if (element.name === ELEMENT.POLYGON) {
		view.areas.push({
			regionCode: required(element, ATTRIBUTE.REGION),
			points: pointsOf(required(element, ATTRIBUTE.POINTS)),
		})
		return
	}
	throw new BodyDiagramFormatError(`unexpected <${element.name}> in a view`)
}

function partOf(element: Element): SilhouettePart {
	const part = Object.values(SILHOUETTE_PART).find((candidate) => candidate === element.attributes.get(ATTRIBUTE.PART))
	if (part === undefined) {
		throw new BodyDiagramFormatError("a silhouette path has an unknown part")
	}
	return part
}

function required(element: Element, attribute: string): string {
	const value = element.attributes.get(attribute)
	if (value === undefined || value === "") {
		throw new BodyDiagramFormatError(`<${element.name}> lacks ${attribute}`)
	}
	return value
}

export function pointsOf(text: string): DiagramPoint[] {
	return text
		.trim()
		.split(WHITESPACE)
		.map((pair) => {
			const [x = Number.NaN, y = Number.NaN, ...rest] = pair.split(POINT_SEPARATOR).map(Number)
			if (rest.length > 0 || !Number.isFinite(x) || !Number.isFinite(y)) {
				throw new BodyDiagramFormatError("an area has a malformed point")
			}
			return { x, y }
		})
}
