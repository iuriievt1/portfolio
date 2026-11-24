// kvalita-rizika-a-pouzitelnost.md 7, ADR-024, Q-040
export const WOUND_SHAPE = {
	ELLIPSE: "ellipse",
	POLYGON: "polygon",
} as const

export type WoundShape = (typeof WOUND_SHAPE)[keyof typeof WOUND_SHAPE]

export interface PrintedWound {
	id: string
	shape: WoundShape
	widthMillimetres: number
	heightMillimetres: number
}

export const IRREGULAR_OUTLINE: readonly (readonly [number, number])[] = [
	[-20, 2],
	[-14, 9],
	[-4, 12.5],
	[7, 10],
	[16, 6],
	[20, -1],
	[13, -9],
	[2, -12.5],
	[-9, -10],
	[-17, -6],
]

export const PRINTED_WOUNDS: readonly PrintedWound[] = [
	{ id: "R01", shape: WOUND_SHAPE.ELLIPSE, widthMillimetres: 20, heightMillimetres: 12 },
	{ id: "R02", shape: WOUND_SHAPE.ELLIPSE, widthMillimetres: 35, heightMillimetres: 22 },
	{ id: "R03", shape: WOUND_SHAPE.ELLIPSE, widthMillimetres: 15, heightMillimetres: 15 },
	{ id: "R04", shape: WOUND_SHAPE.ELLIPSE, widthMillimetres: 50, heightMillimetres: 30 },
	{ id: "R05", shape: WOUND_SHAPE.POLYGON, widthMillimetres: 40, heightMillimetres: 25 },
	{ id: "R06", shape: WOUND_SHAPE.ELLIPSE, widthMillimetres: 60, heightMillimetres: 38 },
]
