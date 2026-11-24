import { APP_VERSION_HEADER, ERROR_CODE, type IntegrityReport } from "@ansora/contracts"
import { AUDIT_EVENT_TYPE, DEVICE_STATE, type DeviceState, SESSION_END_REASON } from "@ansora/core-server"
import type { Request } from "express"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { DeviceAdministrationRepository } from "../repositories/device-administration.repository"
import { DeviceIntegrityService } from "../services/device-integrity.service"
import type { DeviceProofService } from "../services/device-proof.service"
import { DeviceSessionsService } from "../services/device-sessions.service"
import type { DeviceBlocking, EndedSessionRow } from "../types/device-administration.types"

const DEVICE_ID = "11111111-1111-4111-8111-111111111111"
const USER_ID = "22222222-2222-4222-8222-222222222222"
const USER_SESSION_ID = "33333333-3333-4333-8333-333333333333"
const DEVICE_SESSION_ID = "44444444-4444-4444-8444-444444444444"

const REPORT: IntegrityReport = {
	signals: ["root", "debugger"],
	detected_at: "2026-10-29T08:00:00.000Z",
	unsent_items: { count: 4, oldest_acquired_at: "2026-10-28T14:00:00.000Z" },
}

function requestWith(appVersion: string): Request {
	return { header: (name: string) => (name === APP_VERSION_HEADER ? appVersion : undefined) } as unknown as Request
}

interface Harness {
	service: DeviceIntegrityService
	audited: NewAuditEvent[]
	blocked: DeviceBlocking[]
}

function harness(state: DeviceState | undefined, openSessions: EndedSessionRow[] = []): Harness {
	const audited: NewAuditEvent[] = []
	const blocked: DeviceBlocking[] = []
	const proofs = {
		ofKnownDevice: async () => ({ device: { id: DEVICE_ID, state }, jti: "jti" }),
	} as unknown as DeviceProofService
	const devices = {
		lockState: async () => state,
		block: async (_tx: never, _id: string, blocking: DeviceBlocking) => {
			blocked.push(blocking)
		},
		endSessionsOf: async () => openSessions.splice(0),
	} as unknown as DeviceAdministrationRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
		},
	} as unknown as AuditRepository
	const sessions = new DeviceSessionsService(devices, audit)
	return { service: new DeviceIntegrityService(database, proofs, devices, audit, sessions), audited, blocked }
}

describe("report of a modified operating system", () => {
	it("CAP-008-S07 blocks the device with the review and audits what the device reported", async () => {
		const { service, audited, blocked } = harness(DEVICE_STATE.APPROVED)

		await service.report(requestWith("1.0.0+142"), REPORT)

		expect(blocked).toEqual([{ detectedAt: REPORT.detected_at, signals: REPORT.signals, appVersion: "1.0.0" }])
		expect(audited).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.DEVICE_BLOCKING,
				actorKind: "device",
				actorDeviceId: DEVICE_ID,
				objectId: DEVICE_ID,
				outcome: "success",
				details: {
					previous_state: DEVICE_STATE.APPROVED,
					signals: ["root", "debugger"],
					detected_at: REPORT.detected_at,
					app_version: "1.0.0",
					unsent_items: { count: 4, oldest_acquired_at: "2026-10-28T14:00:00.000Z" },
				},
			},
		])
	})

	it("CAP-008-S02 ends the sessions of the blocked device and audits the end of the user session", async () => {
		const sessions = [
			{ id: USER_SESSION_ID, user_id: USER_ID },
			{ id: DEVICE_SESSION_ID, user_id: null },
		]
		const { service, audited } = harness(DEVICE_STATE.APPROVED, sessions)

		await service.report(requestWith("1.0.0+142"), REPORT)

		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.DEVICE_BLOCKING },
			{
				eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
				actorUserId: USER_ID,
				actorDeviceId: DEVICE_ID,
				sessionId: USER_SESSION_ID,
				details: { reason: SESSION_END_REASON.DEVICE_REVOKED },
			},
		])
	})

	it("CAP-008-R05 blocks a device that still waits for approval", async () => {
		const { service, blocked } = harness(DEVICE_STATE.PENDING_APPROVAL)

		await service.report(requestWith("1.0.0+142"), REPORT)

		expect(blocked).toHaveLength(1)
	})

	it("CAP-007-R11 refuses the report of a revoked device and leaves it revoked", async () => {
		const { service, audited, blocked } = harness(DEVICE_STATE.REVOKED)

		const refusal = service.report(requestWith("1.0.0+142"), REPORT)

		await expect(refusal).rejects.toMatchObject({ code: ERROR_CODE.DEVICE_REVOKED })
		expect(blocked).toEqual([])
		expect(audited).toEqual([])
	})

	it("keeps the first review and audits nothing when a blocked device reports again", async () => {
		const { service, audited, blocked } = harness(DEVICE_STATE.BLOCKED)

		await service.report(requestWith("1.0.0+142"), REPORT)

		expect(blocked).toEqual([])
		expect(audited).toEqual([])
	})

	it("CAP-012-S14 keeps only the version of an outdated app without its assembly", async () => {
		const { service, blocked } = harness(DEVICE_STATE.APPROVED)

		await service.report(requestWith("0.9.0+7"), REPORT)

		expect(blocked[0]?.appVersion).toBe("0.9.0")
	})

	it("CAP-007-R11 answers a revoked device with its revocation whatever version it reports", async () => {
		const { service, blocked } = harness(DEVICE_STATE.REVOKED)

		const refusal = service.report(requestWith(`1.0.${"1".repeat(60)}+142`), REPORT)

		await expect(refusal).rejects.toMatchObject({ code: ERROR_CODE.DEVICE_REVOKED })
		expect(blocked).toEqual([])
	})

	it("refuses a version that does not fit the review", async () => {
		const { service, blocked } = harness(DEVICE_STATE.APPROVED)

		const refusal = service.report(requestWith(`1.0.${"1".repeat(60)}+142`), REPORT)

		await expect(refusal).rejects.toMatchObject({ code: ERROR_CODE.RECORD_REJECTED })
		expect(blocked).toEqual([])
	})
})
