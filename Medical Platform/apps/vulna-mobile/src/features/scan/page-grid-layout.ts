import sizes from "../../styles/sizes.json"

// Vulna / Media / Grid tile
const PAGE_TILE_WIDTH = sizes["grid-tile"]
export const PAGE_TILE_HEIGHT = Math.round((PAGE_TILE_WIDTH * sizes.page.height) / sizes.page.width)
const CELL_WIDTH = PAGE_TILE_WIDTH + sizes["grid-gap"]
const CELL_HEIGHT = PAGE_TILE_HEIGHT + sizes["page-number"] + sizes["grid-row-gap"]
const ONE_COLUMN = 1

interface GridSlot {
	x: number
	y: number
}

// Vulna / Media / Grid
export function columnsWithin(width: number): number {
	"worklet"
	return Math.max(ONE_COLUMN, Math.floor((width + sizes["grid-gap"]) / CELL_WIDTH))
}

export function slotOf(index: number, columns: number): GridSlot {
	"worklet"
	return { x: (index % columns) * CELL_WIDTH, y: Math.floor(index / columns) * CELL_HEIGHT }
}

export function gridHeightOf(tiles: number, columns: number): number {
	"worklet"
	const rows = Math.ceil(tiles / columns)
	return rows === 0 ? 0 : rows * CELL_HEIGHT - sizes["grid-row-gap"]
}

// CAP-018-R11
export function indexAt(point: GridSlot, columns: number, count: number): number {
	"worklet"
	const column = Math.min(Math.max(Math.round(point.x / CELL_WIDTH), 0), columns - 1)
	const row = Math.max(Math.round(point.y / CELL_HEIGHT), 0)
	return Math.min(row * columns + column, count - 1)
}

// CAP-018-R11
export function movedKeys(keys: readonly string[], from: number, to: number): string[] {
	"worklet"
	const moved = [...keys]
	const [key] = moved.splice(from, 1)
	if (key !== undefined) {
		moved.splice(to, 0, key)
	}
	return moved
}
