import type { DeviceEvent } from "@ansora/contracts"
import type { BufferedFile, TransferBuffer } from "@ansora/core-mobile"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { deletedCopiesByOperator, removeExpiredCopies } from "../local-copies"

const DAY_SECONDS = 86_400
const NURSE = "11111111-1111-4111-8111-111111111111"
const DOCTOR = "22222222-2222-4222-8222-222222222222"

const state = vi.hoisted(() => ({
	retentionSeconds: undefined as number | undefined,
	recorded: [] as DeviceEvent[],
	removedFromSession: [] as string[],
	forgottenThumbnails: [] as string[],
}))

vi.mock("@ansora/core-mobile", async () => ({
	...(await import("../../../../../../libs/core/mobile/src/device/device-events")),
}))
vi.mock("../local-copy-retention", () => ({ localCopyRetentionSeconds: async () => state.retentionSeconds }))
vi.mock("../../device/device-events", () => ({
	recordDeviceEvents: async (events: readonly DeviceEvent[]) => {
		state.recorded.push(...events)
	},
}))
vi.mock("../../capture/capture-session", () => ({
	removeCapturedPhoto: (_acquisitionId: string, fileKey: string) => {
		state.removedFromSession.push(fileKey)
	},
}))
vi.mock("../../../utils/thumbnail-cache", () => ({
	forgetThumbnail: (thumbnailFileId: string) => {
		state.forgottenThumbnails.push(thumbnailFileId)
	},
}))
vi.mock("../../../utils/random-uuid", () => ({ randomUuid: async () => "33333333-3333-4333-8333-333333333333" }))
vi.mock("../queue-changes", () => ({ markQueueChanged: vi.fn() }))

function copy(fileKey: string, operatorUserId: string, capturedAt: string): BufferedFile {
	return {
		fileKey,
		acquisitionId: "record",
		operatorUserId,
		capturedAt,
		thumbnailFileId: `${fileKey}-thumbnail`,
	} as BufferedFile
}

function bufferWith(expired: readonly BufferedFile[]) {
	const removed: string[] = []
	const cutoffs: Date[] = []
	const buffer = {
		expiredCopies: async (receivedBefore: Date) => {
			cutoffs.push(receivedBefore)
			return expired
		},
		remove: async (fileKey: string) => {
			removed.push(fileKey)
		},
	} as unknown as TransferBuffer
	return { buffer, removed, cutoffs }
}

const NOT_IN_FLIGHT = () => false

beforeEach(() => {
	state.retentionSeconds = DAY_SECONDS
	state.recorded.length = 0
	state.removedFromSession.length = 0
	state.forgottenThumbnails.length = 0
})

describe("local copies of files the server received CAP-026-R08", () => {
	it("CAP-026-S04 CAP-026-S12 deletes the expired copies and reports one deletion per operator", async () => {
		const { buffer, removed, cutoffs } = bufferWith([
			copy("a", NURSE, "2026-10-25T09:00:00.000Z"),
			copy("b", NURSE, "2026-10-25T08:00:00.000Z"),
			copy("c", DOCTOR, "2026-10-25T10:00:00.000Z"),
		])
		const before = Date.now()

		await removeExpiredCopies(buffer, NOT_IN_FLIGHT)

		expect(removed).toEqual(["a", "b", "c"])
		expect(state.removedFromSession).toEqual(["a", "b", "c"])
		expect(state.forgottenThumbnails).toEqual(["a-thumbnail", "b-thumbnail", "c-thumbnail"])
		expect(cutoffs[0]?.getTime()).toBeLessThanOrEqual(before - DAY_SECONDS * 1000 + 1000)
		expect(state.recorded).toMatchObject([
			{
				type: "local-data-deletion",
				user_id: NURSE,
				details: { reason: "local_copy_expired", count: 2, oldest_acquired_at: "2026-10-25T08:00:00.000Z" },
			},
			{
				type: "local-data-deletion",
				user_id: DOCTOR,
				details: { reason: "local_copy_expired", count: 1, oldest_acquired_at: "2026-10-25T10:00:00.000Z" },
			},
		])
	})

	it("leaves a copy that is on its way", async () => {
		const { buffer, removed } = bufferWith([copy("a", NURSE, "2026-10-25T09:00:00.000Z")])

		await removeExpiredCopies(buffer, (fileKey) => fileKey === "a")

		expect(removed).toEqual([])
		expect(state.recorded).toEqual([])
	})

	it("deletes nothing while the device does not know the period", async () => {
		state.retentionSeconds = undefined
		const { buffer, removed, cutoffs } = bufferWith([copy("a", NURSE, "2026-10-25T09:00:00.000Z")])

		await removeExpiredCopies(buffer, NOT_IN_FLIGHT)

		expect(cutoffs).toEqual([])
		expect(removed).toEqual([])
	})

	it("counts the deleted copies of each operator with the capture of the oldest", () => {
		expect(
			deletedCopiesByOperator([
				{ operatorUserId: NURSE, capturedAt: "2026-10-25T09:00:00.000Z" },
				{ operatorUserId: NURSE, capturedAt: "2026-10-24T09:00:00.000Z" },
			]),
		).toEqual(new Map([[NURSE, { count: 2, oldestAcquiredAt: "2026-10-24T09:00:00.000Z" }]]))
	})
})
