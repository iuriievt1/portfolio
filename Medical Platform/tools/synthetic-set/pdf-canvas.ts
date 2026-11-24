// ISO 32000-1 7.5, 8.5, 9.3, D.2
const POINTS_PER_INCH = 72
const MILLIMETRES_PER_INCH = 25.4
const BEZIER_CIRCLE_KAPPA = 0.552_284_749_8
const COORDINATE_DECIMALS = 3
const COLOUR_DECIMALS = 4
const CHANNEL_MAX = 255
const HEX_RADIX = 16
const PDF_HEADER = "%PDF-1.4\n%âãÏÓ\n"
const LATIN1 = "latin1"
const XREF_OFFSET_DIGITS = 10
// ISO 32000-1 7.3.10, 7.5.4
const OBJECT = { CATALOG: 1, PAGES: 2, PAGE: 3, REGULAR_FONT: 4, BOLD_FONT: 5, CONTENT: 6 } as const
const FREE_ENTRY = "0000000000 65535 f \n"
const IN_USE_GENERATION = "00000"
const HEX_CHANNEL_STARTS = [1, 3, 5]
const HEX_CHANNEL_LENGTH = 2

const WIN_ANSI_BEYOND_ASCII: ReadonlyMap<string, number> = new Map([
	["–", 0x96],
	["·", 0xb7],
	["×", 0xd7],
	["á", 0xe1],
	["é", 0xe9],
	["í", 0xed],
	["ý", 0xfd],
	["š", 0x9a],
	["ž", 0x9e],
])

const ASCII_PRINTABLE_FIRST = 0x20
const ASCII_PRINTABLE_LAST = 0x7e

export const FONT = {
	REGULAR: "F1",
	BOLD: "F2",
} as const

export type Font = (typeof FONT)[keyof typeof FONT]

export interface Point {
	x: number
	y: number
}

export function pointsOf(millimetres: number): number {
	return (millimetres * POINTS_PER_INCH) / MILLIMETRES_PER_INCH
}

function formatted(value: number, decimals = COORDINATE_DECIMALS): string {
	return Number(value.toFixed(decimals)).toString()
}

function colourOf(hex: string): string {
	const channels = HEX_CHANNEL_STARTS.map(
		(start) => Number.parseInt(hex.slice(start, start + HEX_CHANNEL_LENGTH), HEX_RADIX) / CHANNEL_MAX,
	)
	return channels.map((channel) => formatted(channel, COLOUR_DECIMALS)).join(" ")
}

// ISO 32000-1 D.2
export function winAnsiOf(text: string): string {
	return [...text]
		.map((character) => {
			const code = character.codePointAt(0) ?? 0
			if (code >= ASCII_PRINTABLE_FIRST && code <= ASCII_PRINTABLE_LAST) {
				return character
			}
			const winAnsi = WIN_ANSI_BEYOND_ASCII.get(character)
			if (winAnsi === undefined) {
				throw new Error(`the character ${character} is not in WinAnsiEncoding`)
			}
			return String.fromCharCode(winAnsi)
		})
		.join("")
}

// ISO 32000-1 7.3.4.2
function literalOf(text: string): string {
	return winAnsiOf(text).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
}

function ellipsePath(centre: Point, radiusX: number, radiusY: number): string {
	const handleX = radiusX * BEZIER_CIRCLE_KAPPA
	const handleY = radiusY * BEZIER_CIRCLE_KAPPA
	const { x, y } = centre
	return [
		`${formatted(x + radiusX)} ${formatted(y)} m`,
		`${formatted(x + radiusX)} ${formatted(y + handleY)} ${formatted(x + handleX)} ${formatted(y + radiusY)} ${formatted(x)} ${formatted(y + radiusY)} c`,
		`${formatted(x - handleX)} ${formatted(y + radiusY)} ${formatted(x - radiusX)} ${formatted(y + handleY)} ${formatted(x - radiusX)} ${formatted(y)} c`,
		`${formatted(x - radiusX)} ${formatted(y - handleY)} ${formatted(x - handleX)} ${formatted(y - radiusY)} ${formatted(x)} ${formatted(y - radiusY)} c`,
		`${formatted(x + handleX)} ${formatted(y - radiusY)} ${formatted(x + radiusX)} ${formatted(y - handleY)} ${formatted(x + radiusX)} ${formatted(y)} c`,
		"h",
	].join("\n")
}

// ISO 32000-1 7.5, 8.5, 9.3
function referenceOf(object: number): string {
	return `${object} 0 R`
}

export class PdfCanvas {
	private readonly operations: string[] = []

	constructor(
		private readonly widthMillimetres: number,
		private readonly heightMillimetres: number,
	) {}

	fillRectangle(corner: Point, widthMillimetres: number, heightMillimetres: number, hex: string): void {
		this.operations.push(
			`${colourOf(hex)} rg`,
			`${formatted(pointsOf(corner.x))} ${formatted(pointsOf(corner.y))} ${formatted(pointsOf(widthMillimetres))} ${formatted(pointsOf(heightMillimetres))} re f`,
		)
	}

	fillEllipse(centre: Point, widthMillimetres: number, heightMillimetres: number, hex: string): void {
		const centrePoints = { x: pointsOf(centre.x), y: pointsOf(centre.y) }
		this.operations.push(
			`${colourOf(hex)} rg`,
			ellipsePath(centrePoints, pointsOf(widthMillimetres / 2), pointsOf(heightMillimetres / 2)),
			"f",
		)
	}

	fillPolygon(vertices: readonly Point[], hex: string): void {
		const [first, ...rest] = vertices
		if (first === undefined) {
			throw new Error("a polygon needs vertices")
		}
		this.operations.push(
			`${colourOf(hex)} rg`,
			`${formatted(pointsOf(first.x))} ${formatted(pointsOf(first.y))} m`,
			...rest.map((vertex) => `${formatted(pointsOf(vertex.x))} ${formatted(pointsOf(vertex.y))} l`),
			"h f",
		)
	}

	strokeLine(from: Point, to: Point, thicknessMillimetres: number, hex: string): void {
		this.operations.push(
			`${colourOf(hex)} RG`,
			`${formatted(pointsOf(thicknessMillimetres))} w`,
			`${formatted(pointsOf(from.x))} ${formatted(pointsOf(from.y))} m ${formatted(pointsOf(to.x))} ${formatted(pointsOf(to.y))} l S`,
		)
	}

	text(origin: Point, font: Font, sizePoints: number, hex: string, text: string): void {
		this.operations.push(
			`${colourOf(hex)} rg`,
			`BT /${font} ${formatted(sizePoints)} Tf ${formatted(pointsOf(origin.x))} ${formatted(pointsOf(origin.y))} Td (${literalOf(text)}) Tj ET`,
		)
	}

	// ISO 32000-1 7.5.2, 7.5.4, 7.5.5
	toBytes(): Buffer {
		const content = `${this.operations.join("\n")}\n`
		const media = `[0 0 ${formatted(pointsOf(this.widthMillimetres))} ${formatted(pointsOf(this.heightMillimetres))}]`
		const fonts = `<< /${FONT.REGULAR} ${referenceOf(OBJECT.REGULAR_FONT)} /${FONT.BOLD} ${referenceOf(OBJECT.BOLD_FONT)} >>`
		const objects: [number, string][] = [
			[OBJECT.CATALOG, `<< /Type /Catalog /Pages ${referenceOf(OBJECT.PAGES)} >>`],
			[OBJECT.PAGES, `<< /Type /Pages /Kids [${referenceOf(OBJECT.PAGE)}] /Count 1 >>`],
			[
				OBJECT.PAGE,
				`<< /Type /Page /Parent ${referenceOf(OBJECT.PAGES)} /MediaBox ${media} /Resources << /Font ${fonts} >> /Contents ${referenceOf(OBJECT.CONTENT)} >>`,
			],
			[OBJECT.REGULAR_FONT, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"],
			[OBJECT.BOLD_FONT, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"],
			[OBJECT.CONTENT, `<< /Length ${Buffer.byteLength(content, LATIN1)} >>\nstream\n${content}endstream`],
		]
		let body = PDF_HEADER
		const offsets: number[] = []
		for (const [number, object] of objects) {
			offsets.push(Buffer.byteLength(body, LATIN1))
			body += `${number} 0 obj\n${object}\nendobj\n`
		}
		const crossReference = Buffer.byteLength(body, LATIN1)
		const entries = offsets
			.map((offset) => `${offset.toString().padStart(XREF_OFFSET_DIGITS, "0")} ${IN_USE_GENERATION} n \n`)
			.join("")
		body += `xref\n0 ${objects.length + 1}\n${FREE_ENTRY}${entries}`
		body += `trailer\n<< /Size ${objects.length + 1} /Root ${referenceOf(OBJECT.CATALOG)} >>\nstartxref\n${crossReference}\n%%EOF\n`
		return Buffer.from(body, LATIN1)
	}
}
