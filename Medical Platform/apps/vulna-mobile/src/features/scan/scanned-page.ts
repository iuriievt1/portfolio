import type { BufferedFile, PageCorner, PageCorners, ScannedPage, SecuredPage } from "@ansora/core-mobile"

const LEFT = 0
const TOP = 0
const RIGHT = 1
const BOTTOM = 1

// CAP-018-R10, CAP-018-S02
export const WHOLE_PAGE: PageCorners = {
	topLeft: { x: LEFT, y: TOP },
	topRight: { x: RIGHT, y: TOP },
	bottomRight: { x: RIGHT, y: BOTTOM },
	bottomLeft: { x: LEFT, y: BOTTOM },
}

export const CORNER_NAMES = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const

export type CornerName = (typeof CORNER_NAMES)[number]

// CAP-018-R08, CAP-018-R11
export function securedPageOf(scanned: ScannedPage): SecuredPage {
	return {
		image: scanned.page,
		thumbnail: scanned.thumbnail,
		original: scanned.original,
		corners: scanned.corners === null ? null : JSON.stringify(scanned.corners),
		width: scanned.width,
		height: scanned.height,
	}
}

// CAP-018-R11
export function cornersOf(page: Pick<BufferedFile, "corners">): PageCorners {
	if (page.corners === null) {
		return WHOLE_PAGE
	}
	try {
		const parsed = JSON.parse(page.corners) as Partial<Record<CornerName, PageCorner>>
		return CORNER_NAMES.every((name) => isCorner(parsed[name])) ? (parsed as PageCorners) : WHOLE_PAGE
	} catch {
		return WHOLE_PAGE
	}
}

// CAP-018-R10
export function movedCorner(corners: PageCorners, name: CornerName, to: PageCorner): PageCorners {
	const moved = { ...corners, [name]: { x: withinPage(to.x), y: withinPage(to.y) } }
	return isConvex(moved) || !isConvex(corners) ? moved : corners
}

// CAP-018-R10
export function isConvex({ topLeft, topRight, bottomRight, bottomLeft }: PageCorners): boolean {
	return [
		turnOf(topLeft, topRight, bottomRight),
		turnOf(topRight, bottomRight, bottomLeft),
		turnOf(bottomRight, bottomLeft, topLeft),
		turnOf(bottomLeft, topLeft, topRight),
	].every((turn) => turn > 0)
}

function turnOf(from: PageCorner, through: PageCorner, to: PageCorner): number {
	return (through.x - from.x) * (to.y - through.y) - (through.y - from.y) * (to.x - through.x)
}

function withinPage(value: number): number {
	return Math.min(Math.max(value, LEFT), RIGHT)
}

function isCorner(value: PageCorner | undefined): value is PageCorner {
	return value !== undefined && typeof value.x === "number" && typeof value.y === "number"
}
