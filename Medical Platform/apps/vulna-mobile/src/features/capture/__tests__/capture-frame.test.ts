import { describe, expect, it } from "vitest"
import { frameCovering, frameWithin } from "../capture-frame"

const PHONE_FRAME_AREA = { width: 393, height: 586 }
const PHONE_SHEET = { width: 393, height: 780 }

describe("viewfinder frame CAP-015-R10", () => {
	it("fits the whole 3 : 4 shot into the area between the bars", () => {
		expect(frameWithin(PHONE_FRAME_AREA)).toEqual({ width: 393, height: 524 })
	})

	it("keeps 3 : 4 when the area is lower than the shot", () => {
		expect(frameWithin({ width: 393, height: 400 })).toEqual({ width: 300, height: 400 })
	})
})

describe("backdrop under the bars Vulna / Capture / Backdrop", () => {
	it("stretches the 3 : 4 copy uniformly over the whole sheet", () => {
		expect(frameCovering(PHONE_SHEET)).toEqual({ width: 585, height: 780 })
	})

	it("covers a sheet wider than 3 : 4 by its width", () => {
		expect(frameCovering({ width: 600, height: 600 })).toEqual({ width: 600, height: 800 })
	})
})
