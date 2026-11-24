import { FONT, PdfCanvas, type Point } from "./pdf-canvas"
import { IRREGULAR_OUTLINE, PRINTED_WOUNDS, type PrintedWound, WOUND_SHAPE } from "./wounds"

// ISO 216 A4
const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297

const COLUMN_COUNT = 2
const CELL_WIDTH = 72
const CELL_HEIGHT = 66
const COLUMN_GAP = 8
const LEFT_MARGIN = (PAGE_WIDTH - (COLUMN_COUNT * CELL_WIDTH + COLUMN_GAP)) / 2
const FIRST_CELL_TOP = 238.5
const ROW_GAP = 5

const TITLE_BASELINE = 262
const SUBTITLE_BASELINE = 256
const CALIBRATION_LENGTH = 100
const CALIBRATION_HEIGHT = 245
const CALIBRATION_LABEL_GAP = 2.5
const CALIBRATION_END_TICK = 3

const LABEL_INSET = 4
const LABEL_DROP = 6
const WOUND_CENTRE_DROP = 30
const WOUND_BED_SCALE = 0.78
const RULER_LENGTH = 50
const RULER_INSET = 8
const RULER_RISE = 8
const MINOR_TICK = 1.5
const HALF_TICK = 2.5
const CENTIMETRE_TICK = 4
const TICKS_PER_HALF = 5
const TICKS_PER_CENTIMETRE = 10
const RULER_NUMBER_DROP = 3.2
const RULER_NUMBER_SHIFT = 0.8
const RULER_UNIT_GAP = 1.6

const LINE_THICKNESS = 0.2
const CALIBRATION_THICKNESS = 0.4

const TITLE_SIZE = 12
const TEXT_SIZE = 8
const RULER_TEXT_SIZE = 6

const INK = "#1a1a1a"
const SKIN = "#e9c2a6"
const WOUND_EDGE = "#7b1e1e"
const WOUND_BED = "#b03a2e"

const TITLE = "Ansora Vulna · syntetická sada · rány R01–R06"
const SUBTITLE = "Vymyšlené rány, žádný pacient. Tisk: A4, 100 %."
const CALIBRATION_LABEL = "Kontrola tisku: 100 mm"
const CENTIMETRE_UNIT = "cm"

function cellCornerOf(index: number): Point {
	const column = index % COLUMN_COUNT
	const row = Math.floor(index / COLUMN_COUNT)
	const left = LEFT_MARGIN + column * (CELL_WIDTH + COLUMN_GAP)
	const top = FIRST_CELL_TOP - row * (CELL_HEIGHT + ROW_GAP)
	return { x: left, y: top - CELL_HEIGHT }
}

function labelOf(wound: PrintedWound): string {
	return `${wound.id} · ${wound.widthMillimetres} × ${wound.heightMillimetres} mm`
}

function scaledOutline(centre: Point, scale: number): Point[] {
	return IRREGULAR_OUTLINE.map(([x, y]) => ({ x: centre.x + x * scale, y: centre.y + y * scale }))
}

function drawWound(canvas: PdfCanvas, wound: PrintedWound, centre: Point): void {
	if (wound.shape === WOUND_SHAPE.POLYGON) {
		canvas.fillPolygon(scaledOutline(centre, 1), WOUND_EDGE)
		canvas.fillPolygon(scaledOutline(centre, WOUND_BED_SCALE), WOUND_BED)
		return
	}
	canvas.fillEllipse(centre, wound.widthMillimetres, wound.heightMillimetres, WOUND_EDGE)
	canvas.fillEllipse(
		centre,
		wound.widthMillimetres * WOUND_BED_SCALE,
		wound.heightMillimetres * WOUND_BED_SCALE,
		WOUND_BED,
	)
}

function tickLengthOf(millimetre: number): number {
	if (millimetre % TICKS_PER_CENTIMETRE === 0) {
		return CENTIMETRE_TICK
	}
	return millimetre % TICKS_PER_HALF === 0 ? HALF_TICK : MINOR_TICK
}

// brief.md K07
function drawRuler(canvas: PdfCanvas, start: Point): void {
	canvas.strokeLine(start, { x: start.x + RULER_LENGTH, y: start.y }, LINE_THICKNESS, INK)
	for (let millimetre = 0; millimetre <= RULER_LENGTH; millimetre += 1) {
		const x = start.x + millimetre
		canvas.strokeLine({ x, y: start.y }, { x, y: start.y + tickLengthOf(millimetre) }, LINE_THICKNESS, INK)
		if (millimetre % TICKS_PER_CENTIMETRE === 0) {
			const centimetres = String(millimetre / TICKS_PER_CENTIMETRE)
			canvas.text(
				{ x: x - RULER_NUMBER_SHIFT, y: start.y - RULER_NUMBER_DROP },
				FONT.REGULAR,
				RULER_TEXT_SIZE,
				INK,
				centimetres,
			)
		}
	}
	canvas.text(
		{ x: start.x + RULER_LENGTH + RULER_UNIT_GAP, y: start.y - RULER_NUMBER_DROP },
		FONT.REGULAR,
		RULER_TEXT_SIZE,
		INK,
		CENTIMETRE_UNIT,
	)
}

function drawCell(canvas: PdfCanvas, wound: PrintedWound, index: number): void {
	const corner = cellCornerOf(index)
	const top = corner.y + CELL_HEIGHT
	canvas.fillRectangle(corner, CELL_WIDTH, CELL_HEIGHT, SKIN)
	canvas.text({ x: corner.x + LABEL_INSET, y: top - LABEL_DROP }, FONT.BOLD, TEXT_SIZE, INK, labelOf(wound))
	drawWound(canvas, wound, { x: corner.x + CELL_WIDTH / 2, y: top - WOUND_CENTRE_DROP })
	drawRuler(canvas, { x: corner.x + RULER_INSET, y: corner.y + RULER_RISE })
}

// kvalita-rizika-a-pouzitelnost.md 7
function drawCalibration(canvas: PdfCanvas): void {
	const left = (PAGE_WIDTH - CALIBRATION_LENGTH) / 2
	const right = left + CALIBRATION_LENGTH
	canvas.strokeLine({ x: left, y: CALIBRATION_HEIGHT }, { x: right, y: CALIBRATION_HEIGHT }, CALIBRATION_THICKNESS, INK)
	for (const x of [left, right]) {
		canvas.strokeLine(
			{ x, y: CALIBRATION_HEIGHT - CALIBRATION_END_TICK },
			{ x, y: CALIBRATION_HEIGHT + CALIBRATION_END_TICK },
			CALIBRATION_THICKNESS,
			INK,
		)
	}
	canvas.text(
		{ x: left, y: CALIBRATION_HEIGHT + CALIBRATION_END_TICK + CALIBRATION_LABEL_GAP },
		FONT.REGULAR,
		TEXT_SIZE,
		INK,
		CALIBRATION_LABEL,
	)
}

// kvalita-rizika-a-pouzitelnost.md 7, ADR-024, Q-040
export function printSheetPdf(): Buffer {
	const canvas = new PdfCanvas(PAGE_WIDTH, PAGE_HEIGHT)
	canvas.text({ x: LEFT_MARGIN, y: TITLE_BASELINE }, FONT.BOLD, TITLE_SIZE, INK, TITLE)
	canvas.text({ x: LEFT_MARGIN, y: SUBTITLE_BASELINE }, FONT.REGULAR, TEXT_SIZE, INK, SUBTITLE)
	drawCalibration(canvas)
	for (const [index, wound] of PRINTED_WOUNDS.entries()) {
		drawCell(canvas, wound, index)
	}
	return canvas.toBytes()
}

// kvalita-rizika-a-pouzitelnost.md 7
export function woundsJson(): string {
	const wounds = PRINTED_WOUNDS.map((wound) => ({
		id: wound.id,
		shape: wound.shape,
		width_mm: wound.widthMillimetres,
		height_mm: wound.heightMillimetres,
	}))
	return `${JSON.stringify({ description: "Synthetic printed wounds; every wound is invented.", wounds }, null, "\t")}\n`
}
