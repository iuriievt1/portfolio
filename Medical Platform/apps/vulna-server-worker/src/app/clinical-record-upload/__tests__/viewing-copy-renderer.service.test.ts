import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { ViewingCopyRendererService } from "../services/viewing-copy-renderer.service"
import { ORIENTATION } from "../utils/jpeg-segments"
import { viewingCopyOf } from "../utils/viewing-copy"
import { photoOf, rasterOf } from "./jpeg-fixtures"

const SETTINGS = { maxLongEdgePx: 16, quality: 70 }
const PHOTO = photoOf(
	rasterOf(64, 32, () => [200, 120, 90]),
	ORIENTATION.ROTATED_90,
)
const TEST_EXEC_ARGV = process.execArgv

beforeAll(() => {
	process.execArgv = [...TEST_EXEC_ARGV, "--require", "@swc-node/register"]
})

afterAll(() => {
	process.execArgv = TEST_EXEC_ARGV
})

describe("viewing copy made off the main thread CAP-021-R40", () => {
	it("CAP-021-R40 makes in a thread the same copy as on the main thread", async () => {
		const copy = await new ViewingCopyRendererService().copyOf(PHOTO, SETTINGS)

		expect(Buffer.isBuffer(copy)).toBe(true)
		expect(copy.equals(viewingCopyOf(PHOTO, SETTINGS))).toBe(true)
	})

	it("CAP-021-R40 fails with the error of the thread for bytes that are not a photo", async () => {
		await expect(new ViewingCopyRendererService().copyOf(Buffer.from("not a photo"), SETTINGS)).rejects.toThrow(
			"SOI not found",
		)
	})
})
