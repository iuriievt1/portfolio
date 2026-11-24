import { DEVICE_EVENT_TYPE, type DeviceEvent, ERROR_CODE, LOCAL_DATA_DELETION_REASON } from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_EVENT_TYPE, DEVICE_STATE, type DeviceState } from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import type { RecordedDeviceEventRepository } from "../repositories/recorded-device-event.repository"
import { DeviceEventService } from "../services/device-event.service"
import type { DeviceProofService } from "../services/device-proof.service"

const DEVICE_ID = "11111111-1111-4111-8111-111111111111"
const USER_ID = "22222222-2222-4222-8222-222222222222"
const DELETION_KEY = "33333333-3333-4333-8333-333333333333"
const MISMATCH_KEY = "44444444-4444-4444-8444-444444444444"
const REQUEST = {} as Request

const DELETION: DeviceEvent = {
	idempotency_key: DELETION_KEY,
	type: DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION,
	originated_at: "2026-10-26T08:00:00.000Z",
	user_id: null,
	details: {
		reason: LOCAL_DATA_DELETION_REASON.DEVICE_REVOCATION,
		count: 2,
		oldest_acquired_at: "2026-10-25T14:00:00.000Z",
	},
}

const MISMATCH: DeviceEvent = {
	idempotency_key: MISMATCH_KEY,
	type: DEVICE_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH,
	originated_at: "2026-10-24T08:00:00.000Z",
	user_id: USER_ID,
	details: {
		server_authorization_endpoint: "https://idp.example/authorize",
		provider_authorization_endpoint: null,
		discovery_url: "https://idp.example/.well-known/openid-configuration",
	},
}

interface Harness {
	service: DeviceEventService
	audited: NewAuditEvent[]
}

function harness(state: DeviceState, recordedBefore: readonly string[] = []): Harness {
	const audited: NewAuditEvent[] = []
	const recorded = new Set(recordedBefore)
	const proofs = {
		ofKnownDevice: async () => ({ device: { id: DEVICE_ID, state }, jti: "jti" }),
	} as unknown as DeviceProofService
	const repository = {
		recordNew: async (_sql: unknown, keys: readonly string[]) => {
			const fresh = keys.filter((key) => !recorded.has(key))
			for (const key of fresh) {
				recorded.add(key)
			}
			return new Set(fresh.map((key) => key.toLowerCase()))
		},
	} as unknown as RecordedDeviceEventRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const audit = {
		append: async (_tx: unknown, event: NewAuditEvent) => {
			audited.push(event)
		},
	} as unknown as AuditRepository
	return { service: new DeviceEventService(database, proofs, repository, audit), audited }
}

describe("audit events that arise only on the device", () => {
	it("CAP-025-R22 records each event with its time on the device and returns its key", async () => {
		const { service, audited } = harness(DEVICE_STATE.APPROVED)

		const receipt = await service.record(REQUEST, { events: [MISMATCH] })

		expect(receipt).toEqual({ recorded_keys: [MISMATCH_KEY] })
		expect(audited).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH,
				actorKind: AUDIT_ACTOR_KIND.USER,
				actorUserId: USER_ID,
				actorDeviceId: DEVICE_ID,
				outcome: "success",
				details: {
					originated_at: MISMATCH.originated_at,
					idempotency_key: MISMATCH_KEY,
					event_details: MISMATCH.details,
				},
			},
		])
	})

	it("CAP-025-S14 accepts the whole batch with the deletion from a revoked device", async () => {
		const { service, audited } = harness(DEVICE_STATE.REVOKED)

		const receipt = await service.record(REQUEST, { events: [MISMATCH, DELETION] })

		expect(receipt).toEqual({ recorded_keys: [MISMATCH_KEY, DELETION_KEY] })
		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.AUTHORIZATION_ENDPOINT_MISMATCH },
			{
				eventType: AUDIT_EVENT_TYPE.LOCAL_DATA_DELETION,
				actorKind: AUDIT_ACTOR_KIND.DEVICE,
				actorDeviceId: DEVICE_ID,
				details: { event_details: DELETION.details },
			},
		])
		expect(audited[1]).not.toHaveProperty("actorUserId")
	})

	it("CAP-025-R22 accepts the deletion also from a blocked device", async () => {
		const { service, audited } = harness(DEVICE_STATE.BLOCKED)

		await service.record(REQUEST, { events: [DELETION] })

		expect(audited).toHaveLength(1)
	})

	it("refuses a batch without a deletion from a revoked device", async () => {
		const { service, audited } = harness(DEVICE_STATE.REVOKED)

		const refusal = await service.record(REQUEST, { events: [MISMATCH] }).catch((error: unknown) => error)

		expect(refusal).toBeInstanceOf(ProblemException)
		expect((refusal as ProblemException).code).toBe(ERROR_CODE.DEVICE_REVOKED)
		expect(audited).toEqual([])
	})

	it("refuses events from a device that still waits for approval", async () => {
		const { service } = harness(DEVICE_STATE.PENDING_APPROVAL)

		const refusal = await service.record(REQUEST, { events: [DELETION] }).catch((error: unknown) => error)

		expect((refusal as ProblemException).code).toBe(ERROR_CODE.DEVICE_PENDING_APPROVAL)
	})

	it("CAP-025-R22 records an event whose key the device wrote in capitals", async () => {
		const { service, audited } = harness(DEVICE_STATE.APPROVED)
		const shouted = { ...MISMATCH, idempotency_key: "A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11" }

		const receipt = await service.record(REQUEST, { events: [shouted] })

		expect(receipt).toEqual({ recorded_keys: [shouted.idempotency_key] })
		expect(audited).toHaveLength(1)
	})

	it("CAP-025-S15 records a delivered event only once and still returns its key", async () => {
		const { service, audited } = harness(DEVICE_STATE.REVOKED, [DELETION_KEY])

		const receipt = await service.record(REQUEST, { events: [DELETION] })

		expect(receipt).toEqual({ recorded_keys: [DELETION_KEY] })
		expect(audited).toEqual([])
	})
})
