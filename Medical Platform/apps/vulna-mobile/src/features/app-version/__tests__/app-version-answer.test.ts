import { describe, expect, it, vi } from "vitest"
import { rejectionAfter } from "../app-version-store"

vi.mock("../../session/session-store", () => ({ currentSession: () => undefined }))

describe("answer of the server to the app version", () => {
	it("CAP-012-S11 remembers a rejected version", () => {
		expect(rejectionAfter({ isRejected: true, wasRejected: false, hasSession: false })).toBe(true)
		expect(rejectionAfter({ isRejected: true, wasRejected: false, hasSession: true })).toBe(true)
	})

	it("CAP-012-R25 keeps the rejection for the rest of the session when a request of the started draft succeeds", () => {
		expect(rejectionAfter({ isRejected: false, wasRejected: true, hasSession: true })).toBe(true)
	})

	it("CAP-012-R24 forgets the rejection once the server accepts the app outside a session", () => {
		expect(rejectionAfter({ isRejected: false, wasRejected: true, hasSession: false })).toBe(false)
	})
})
