import { describe, expect, it } from "vitest"
import { awaitScannedCode, finishCodeScan } from "../scanned-code"

const FIRST_CODE = "VULNA1.1.FIRST.SIGNATURE"
const SECOND_CODE = "VULNA1.1.SECOND.SIGNATURE"

describe("scanned code", () => {
	it("CAP-001-S29 delivers the first reading only and drops a second one right after it", async () => {
		const scanned = awaitScannedCode()
		finishCodeScan(FIRST_CODE)
		finishCodeScan(SECOND_CODE)
		expect(await scanned).toBe(FIRST_CODE)
	})

	it("cancels a waiting scan when a new one starts", async () => {
		const first = awaitScannedCode()
		const second = awaitScannedCode()
		finishCodeScan(FIRST_CODE)
		expect(await first).toBeUndefined()
		expect(await second).toBe(FIRST_CODE)
	})
})
