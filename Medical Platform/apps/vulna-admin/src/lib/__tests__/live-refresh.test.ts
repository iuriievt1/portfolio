import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LIVE_REFRESH_SECONDS, liveRefreshText, type ShownPage, startLiveRefresh } from "@/lib/live-refresh"

const MILLISECONDS_PER_SECOND = 1000
const INTERVAL_MILLISECONDS = LIVE_REFRESH_SECONDS * MILLISECONDS_PER_SECOND

class FakePage implements ShownPage {
	visibilityState: DocumentVisibilityState = "visible"
	private readonly listeners = new Set<() => void>()

	addEventListener(_type: "visibilitychange", listener: () => void): void {
		this.listeners.add(listener)
	}

	removeEventListener(_type: "visibilitychange", listener: () => void): void {
		this.listeners.delete(listener)
	}

	show(state: DocumentVisibilityState): void {
		this.visibilityState = state
		for (const listener of this.listeners) {
			listener()
		}
	}

	get listenerCount(): number {
		return this.listeners.size
	}
}

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

describe("the live state of the administration ✓ CAP-028-R14", () => {
	it("says the state refreshes continuously", () => {
		expect(liveRefreshText()).toBe("Obnovuje se průběžně.")
	})

	it("CAP-028-R14 refreshes the shown page every interval", async () => {
		const refresh = vi.fn()
		const stop = startLiveRefresh(refresh, new FakePage(), LIVE_REFRESH_SECONDS)

		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS * 3)

		expect(refresh).toHaveBeenCalledTimes(3)
		stop()
	})

	it("asks nothing while the page is hidden and refreshes as soon as it is shown again", async () => {
		const page = new FakePage()
		const refresh = vi.fn()
		const stop = startLiveRefresh(refresh, page, LIVE_REFRESH_SECONDS)

		page.show("hidden")
		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS * 5)
		expect(refresh).not.toHaveBeenCalled()

		page.show("visible")
		await vi.advanceTimersByTimeAsync(0)
		expect(refresh).toHaveBeenCalledTimes(1)
		stop()
	})

	it("does not start another refresh while the previous one is still running", async () => {
		let finish: () => void = () => undefined
		const refresh = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve
				}),
		)
		const stop = startLiveRefresh(refresh, new FakePage(), LIVE_REFRESH_SECONDS)

		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS * 4)
		expect(refresh).toHaveBeenCalledTimes(1)

		finish()
		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS)
		expect(refresh).toHaveBeenCalledTimes(2)
		stop()
	})

	it("keeps refreshing after a refresh failed", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		const refresh = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined)
		const stop = startLiveRefresh(refresh, new FakePage(), LIVE_REFRESH_SECONDS)

		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS * 2)

		expect(refresh).toHaveBeenCalledTimes(2)
		expect(warn).toHaveBeenCalledTimes(1)
		stop()
		warn.mockRestore()
	})

	it("waits a whole interval after a slow refresh before the next one", async () => {
		const slowRefreshMilliseconds = INTERVAL_MILLISECONDS - 1
		const refresh = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, slowRefreshMilliseconds)))
		const stop = startLiveRefresh(refresh, new FakePage(), LIVE_REFRESH_SECONDS)

		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS + slowRefreshMilliseconds + 1)
		expect(refresh).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS)
		expect(refresh).toHaveBeenCalledTimes(2)
		stop()
	})

	it("stops refreshing and listening once the page is left", async () => {
		const page = new FakePage()
		const refresh = vi.fn()
		const stop = startLiveRefresh(refresh, page, LIVE_REFRESH_SECONDS)

		stop()
		await vi.advanceTimersByTimeAsync(INTERVAL_MILLISECONDS * 3)

		expect(refresh).not.toHaveBeenCalled()
		expect(page.listenerCount).toBe(0)
	})
})
