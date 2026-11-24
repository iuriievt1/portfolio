import { describe, expect, it } from "vitest"
import { peakResidentBytesOf } from "../utils/process-status"

const LIVE_STATUS =
	"Name:\ttesseract\nState:\tR (running)\nVmPeak:\t  412000 kB\nVmHWM:\t   92700 kB\nVmRSS:\t   90000 kB\n"
const ZOMBIE_STATUS = "Name:\ttesseract\nState:\tZ (zombie)\nThreads:\t1\n"

describe("peakResidentBytesOf", () => {
	it("CAP-022-R02 reads the peak resident memory of a running process", () => {
		expect(peakResidentBytesOf(LIVE_STATUS)).toBe(92_700 * 1024)
	})

	it("CAP-022-R02 reads nothing from a process that already ended", () => {
		expect(peakResidentBytesOf(ZOMBIE_STATUS)).toBeUndefined()
	})
})
