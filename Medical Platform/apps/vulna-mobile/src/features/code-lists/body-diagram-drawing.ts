import { type BodyDiagramDrawing, readBodyDiagramSvg } from "@ansora/contracts"
import type { BodyDiagram } from "../../api/code-lists"

let knownDrawing: BodyDiagramDrawing | undefined

// CAP-007-R04
export function forgetBodyDiagramDrawing(): void {
	knownDrawing = undefined
}

// CAP-016-R07, CAP-016-R08, getBodyDiagramBackground
export async function drawingOf(
	bodyDiagram: BodyDiagram,
	readBackground: (backgroundUrl: string) => Promise<string>,
): Promise<BodyDiagramDrawing> {
	const { version, background_url: backgroundUrl } = bodyDiagram
	if (knownDrawing?.version === version) {
		return knownDrawing
	}
	if (backgroundUrl === undefined) {
		throw new Error(`the body diagram ${version} names no background`)
	}
	const drawing = readBodyDiagramSvg(await readBackground(backgroundUrl))
	if (drawing.version !== version) {
		throw new Error(`the background of the body diagram ${version} is of version ${drawing.version}`)
	}
	knownDrawing = drawing
	return drawing
}
