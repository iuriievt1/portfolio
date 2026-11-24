import { beforeEach, describe, expect, it, vi } from "vitest"
import { blockedPredecessor, blockMarkers, forgetBlockMarkerOnceApproved } from "../block-markers"

const DEVICE_STATUS = vi.hoisted(
	() =>
		({
			PENDING_APPROVAL: "pending_approval",
			APPROVED: "approved",
			REVOKED: "revoked",
		}) as const,
)

const store = vi.hoisted(() => ({ items: new Map<string, string>() }))

vi.mock("@ansora/core-mobile", async () => ({
	DEVICE_STATUS,
	blockMarkerOf: (stored: string | null) => (stored === null ? undefined : JSON.parse(stored)),
}))
vi.mock("expo-secure-store", () => ({
	getItemAsync: async (key: string) => store.items.get(key) ?? null,
	setItemAsync: async (key: string, value: string) => {
		store.items.set(key, value)
	},
	deleteItemAsync: async (key: string) => {
		store.items.delete(key)
	},
}))

const MARKER = { predecessorHwId: "blocked-hw-id", detectedAt: "2026-10-29T08:00:00.000Z" }

async function settled(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
	store.items.clear()
})

describe("marker of the blocked predecessor", () => {
	it("CAP-006-S13 reports the HW ID of the blocked predecessor with the new registration", async () => {
		await blockMarkers.write(MARKER)

		expect(await blockedPredecessor()).toEqual({ blockedPredecessorHwId: "blocked-hw-id" })
	})

	it("registers without a marker when no block preceded", async () => {
		expect(await blockedPredecessor()).toEqual({})
	})

	it("CAP-006-R19 keeps the marker until the administrator approves the new registration", async () => {
		await blockMarkers.write(MARKER)

		forgetBlockMarkerOnceApproved({ kind: DEVICE_STATUS.PENDING_APPROVAL })
		forgetBlockMarkerOnceApproved({ kind: DEVICE_STATUS.REVOKED })
		await settled()
		expect(await blockMarkers.read()).toEqual(MARKER)

		forgetBlockMarkerOnceApproved({ kind: DEVICE_STATUS.APPROVED })
		await settled()
		expect(await blockMarkers.read()).toBeUndefined()
	})
})
