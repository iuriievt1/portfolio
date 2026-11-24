import { afterEach, describe, expect, it } from "vitest"
import { forgetThumbnail, forgetThumbnails, shownThumbnail } from "../thumbnail-cache"

const KEY = "image-1"
const URI = "data:image/jpeg;base64,AA=="

afterEach(() => forgetThumbnails())

describe("shown thumbnails", () => {
	it("ADR-026 reads a thumbnail once and again after a failure", async () => {
		let reads = 0
		const failing = shownThumbnail(KEY, async () => {
			reads += 1
			throw new Error("offline")
		})
		await expect(failing).rejects.toThrow("offline")
		const uri = await shownThumbnail(KEY, async () => {
			reads += 1
			return URI
		})
		await shownThumbnail(KEY, async () => {
			reads += 1
			return "unused"
		})
		expect(uri).toBe(URI)
		expect(reads).toBe(2)
	})

	it("keeps a newer read when an older failed read settles late", async () => {
		let failOlder: (failure: Error) => void = () => {}
		const older = shownThumbnail(
			KEY,
			() =>
				new Promise<string>((_, reject) => {
					failOlder = reject
				}),
		)
		forgetThumbnail(KEY)
		const newer = shownThumbnail(KEY, async () => URI)
		failOlder(new Error("offline"))
		await expect(older).rejects.toThrow("offline")

		expect(await shownThumbnail(KEY, async () => "unused")).toBe(await newer)
	})

	it("CAP-015-R34 reads an edited photo's thumbnail again", async () => {
		await shownThumbnail(KEY, async () => URI)
		forgetThumbnail(KEY)

		expect(await shownThumbnail(KEY, async () => "edited")).toBe("edited")
	})
})
