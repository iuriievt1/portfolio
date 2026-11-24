import type { BufferedFile, PageCorners } from "@ansora/core-mobile"

const TURNS_PER_CIRCLE = 4
const NO_TURN = 0

interface StoredGeometry {
	quarterTurns?: unknown
}

// CAP-018-R11, CAP-015-R34
export function quarterTurnsOf(page: Pick<BufferedFile, "corners">): number {
	if (page.corners === null) {
		return NO_TURN
	}
	try {
		const { quarterTurns } = JSON.parse(page.corners) as StoredGeometry
		return typeof quarterTurns === "number" && Number.isInteger(quarterTurns) ? circleTurnsOf(quarterTurns) : NO_TURN
	} catch {
		return NO_TURN
	}
}

// CAP-018-R10, CAP-018-R11
export function pageGeometryOf(corners: PageCorners, quarterTurns: number): string {
	const { topLeft, topRight, bottomRight, bottomLeft } = corners
	return JSON.stringify({ topLeft, topRight, bottomRight, bottomLeft, quarterTurns: circleTurnsOf(quarterTurns) })
}

// CAP-018-R10
export function plainCornersOf({ topLeft, topRight, bottomRight, bottomLeft }: PageCorners): PageCorners {
	return { topLeft, topRight, bottomRight, bottomLeft }
}

function circleTurnsOf(quarterTurns: number): number {
	return ((quarterTurns % TURNS_PER_CIRCLE) + TURNS_PER_CIRCLE) % TURNS_PER_CIRCLE
}
