import { EventEmitter } from "node:events"
import { describe, expect, it, vi } from "vitest"
import { ViewingCopyRendererService } from "../services/viewing-copy-renderer.service"

const SETTINGS = { maxLongEdgePx: 16, quality: 70 }
const ORIGINAL = Buffer.from("original")
const COPY = Uint8Array.from([1, 2, 3])
const WATCH_MODE_MESSAGE = { "watch:require": ["/app/viewing-copy.thread.ts"] }
const SUCCESSFUL_EXIT = 0

const threadMessages = vi.hoisted(() => ({ current: [] as unknown[] }))

vi.mock("node:worker_threads", () => ({
	Worker: class extends EventEmitter {
		constructor() {
			super()
			setImmediate(() => {
				for (const message of threadMessages.current) {
					this.emit("message", message)
				}
				this.emit("exit", SUCCESSFUL_EXIT)
			})
		}
	},
}))

describe("viewing copy made off the main thread CAP-021-R40", () => {
	it("CAP-021-R40 takes the copy from the thread past messages that are not a copy", async () => {
		threadMessages.current = [WATCH_MODE_MESSAGE, COPY]

		const copy = await new ViewingCopyRendererService().copyOf(ORIGINAL, SETTINGS)

		expect([...copy]).toEqual([...COPY])
	})

	it("CAP-021-R40 fails when the thread ends with no copy among its messages", async () => {
		threadMessages.current = [WATCH_MODE_MESSAGE]

		await expect(new ViewingCopyRendererService().copyOf(ORIGINAL, SETTINGS)).rejects.toThrow(
			"the viewing copy thread exited without a copy",
		)
	})
})
