import { DEPENDENCY_STATE } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import { ClinicalRecordStoreObservation } from "../clinical-record-store-observation"

const STARTED_AT = Date.UTC(2026, 9, 27, 8, 0, 0)
const MINUTE = 60_000

describe("ClinicalRecordStoreObservation", () => {
	it("CAP-028-S09 counts the requests rejected during the outage and starts again after an answer", () => {
		const store = new ClinicalRecordStoreObservation()

		store.recordRejectedRequest(STARTED_AT)
		store.recordRejectedRequest(STARTED_AT + MINUTE)

		expect(store.rejectedRequestCount()).toBe(2)
		expect(store.state()).toBe(DEPENDENCY_STATE.UNAVAILABLE)

		store.recordAnswer()

		expect(store.rejectedRequestCount()).toBe(0)
		expect(store.rejectedRequestTotal()).toBe(2)
		expect(store.state()).toBe(DEPENDENCY_STATE.AVAILABLE)
		expect(store.outageSeconds()).toBeUndefined()
	})
})
