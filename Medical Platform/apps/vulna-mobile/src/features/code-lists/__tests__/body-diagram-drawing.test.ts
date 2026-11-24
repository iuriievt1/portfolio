import { BODY_VIEW, type BodyDiagramDrawing, bodyDiagramSvg, SILHOUETTE_PART } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import type { BodyDiagram } from "../../../api/code-lists"
import { drawingOf } from "../body-diagram-drawing"

const VIEW = {
	silhouette: [{ part: SILHOUETTE_PART.FILL, path: "M50 50H150V350H50Z" }],
	areas: [
		{
			regionCode: "51027004",
			points: [
				{ x: 0, y: 0 },
				{ x: 200, y: 0 },
				{ x: 200, y: 400 },
			],
		},
	],
}

function drawingIn(version: string): BodyDiagramDrawing {
	return {
		version,
		views: {
			[BODY_VIEW.ANTERIOR]: { frame: { x: 0, y: 0, width: 200, height: 400 }, ...VIEW },
			[BODY_VIEW.POSTERIOR]: { frame: { x: 200, y: 0, width: 200, height: 400 }, ...VIEW },
		},
	}
}

function bodyDiagram(version: string): BodyDiagram {
	return { version, background_url: `/body-diagrams/${version}/background`, regions: [] }
}

describe("body diagram drawing", () => {
	it("CAP-016-R07 reads the background of the version once and keeps it", async () => {
		const asked: string[] = []
		const read = async (url: string) => {
			asked.push(url)
			return bodyDiagramSvg(drawingIn("11"))
		}
		expect((await drawingOf(bodyDiagram("11"), read)).version).toBe("11")
		expect((await drawingOf(bodyDiagram("11"), read)).version).toBe("11")
		expect(asked).toEqual(["/body-diagrams/11/background"])
	})

	it("CAP-016-R08 refuses a background of another version", async () => {
		await expect(drawingOf(bodyDiagram("12"), async () => bodyDiagramSvg(drawingIn("13")))).rejects.toThrow(
			"of version 13",
		)
	})

	it("refuses a body diagram without a background", async () => {
		await expect(
			drawingOf({ version: "14", regions: [] }, async () => bodyDiagramSvg(drawingIn("14"))),
		).rejects.toThrow("names no background")
	})
})
