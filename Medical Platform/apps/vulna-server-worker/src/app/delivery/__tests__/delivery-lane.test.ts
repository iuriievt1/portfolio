import { MILLISECONDS_PER_SECOND } from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DeliveryInstanceRepository } from "../repositories/delivery-instance.repository"
import { DeliveryLane } from "../services/delivery-lane"
import type { DeliveryRecorderService } from "../services/delivery-recorder.service"
import type { DeliverySettingsService } from "../services/delivery-settings.service"
import type { InstanceDeliveryService } from "../services/instance-delivery.service"
import type { ClaimedDeliveryTask } from "../types/delivery.types"
import { BACKOFF, settingsWith } from "./delivery-fixtures"

const TIMING = { leaseMilliseconds: 160_000, pollMilliseconds: 5000 }
const TASK: ClaimedDeliveryTask = {
	id: "55555555-5555-4555-8555-555555555555",
	objectKind: "delivery_instance",
	objectId: "11111111-1111-4111-8111-111111111111",
	attempts: 0,
	unknownOutcomes: 0,
	requestedAt: "1791363600123456",
}

describe("delivery lane ✓ ADR-016 ř. 54, datovy-model.md 4 „Úloha fronty“", () => {
	it("postpones a task whose delivery failed by the shortest backoff, through the lease it holds", async () => {
		const postponed: { taskId: string; lockedBy: string; delayMilliseconds: number }[] = []
		const instances = {
			queue: { claim: async () => TASK, renewLease: async () => true },
			claimCondition: () => undefined,
		} as unknown as DeliveryInstanceRepository
		const settings = { current: async () => settingsWith() } as unknown as DeliverySettingsService
		const delivery = {
			deliver: async () => {
				throw new Error("the database went away")
			},
		} as unknown as InstanceDeliveryService
		const recorder = {
			postpone: async (task: ClaimedDeliveryTask, lease: { lockedBy: string }, delayMilliseconds: number) =>
				void postponed.push({ taskId: task.id, lockedBy: lease.lockedBy, delayMilliseconds }),
		} as unknown as DeliveryRecorderService
		const lane = new DeliveryLane(TIMING, instances, settings, delivery, recorder)

		expect(await lane.runNext()).toBe(true)
		expect(postponed).toEqual([
			{
				taskId: TASK.id,
				lockedBy: expect.any(String),
				delayMilliseconds: BACKOFF.minimumSeconds * MILLISECONDS_PER_SECOND,
			},
		])
	})
})
