import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import { RequestRateService } from "../services/request-rate.service"

const DEVICE = "device-a"
const OTHER_DEVICE = "device-b"
const LIMIT = 2
const START = new Date("2026-10-02T10:00:00.000Z")

function secondsLater(seconds: number): Date {
	return new Date(START.getTime() + seconds * MILLISECONDS_PER_SECOND)
}

describe("RequestRateService", () => {
	it("allows the limit within a minute and refuses the next request until the window ends", () => {
		const rates = new RequestRateService()
		expect(rates.take(DEVICE, LIMIT, START)).toEqual({ allowed: true })
		expect(rates.take(DEVICE, LIMIT, secondsLater(10))).toEqual({ allowed: true })
		expect(rates.take(DEVICE, LIMIT, secondsLater(20))).toEqual({ allowed: false, retryAfterSeconds: 40 })
	})

	it("starts a new window after a minute", () => {
		const rates = new RequestRateService()
		rates.take(DEVICE, LIMIT, START)
		rates.take(DEVICE, LIMIT, START)
		expect(rates.take(DEVICE, LIMIT, secondsLater(60))).toEqual({ allowed: true })
	})

	it("counts every device on its own", () => {
		const rates = new RequestRateService()
		rates.take(DEVICE, LIMIT, START)
		rates.take(DEVICE, LIMIT, START)
		expect(rates.take(OTHER_DEVICE, LIMIT, START)).toEqual({ allowed: true })
	})
})
