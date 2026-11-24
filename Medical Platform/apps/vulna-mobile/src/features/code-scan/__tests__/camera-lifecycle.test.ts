import { describe, expect, it, vi } from "vitest"
import { cameraErrorHandlerOf } from "../camera-lifecycle"

const CAMERA_DISABLED = new Error("Camera is disabled, probably due to a device policy!")

describe("cameraErrorHandlerOf CAP-015-R10 CAP-013-R02", () => {
	it("stays silent when the system takes the camera from an app in the background", () => {
		const report = vi.fn()

		cameraErrorHandlerOf(() => false, report)(CAMERA_DISABLED)

		expect(report).not.toHaveBeenCalled()
	})

	it("reports a camera failure while the app is in the foreground", () => {
		const report = vi.fn()

		cameraErrorHandlerOf(() => true, report)(CAMERA_DISABLED)

		expect(report).toHaveBeenCalledWith(CAMERA_DISABLED)
	})

	it("reads the app state when the error arrives, not when the handler is made", () => {
		const report = vi.fn()
		let isAppActive = true
		const onError = cameraErrorHandlerOf(() => isAppActive, report)

		isAppActive = false
		onError(CAMERA_DISABLED)

		expect(report).not.toHaveBeenCalled()
	})
})
