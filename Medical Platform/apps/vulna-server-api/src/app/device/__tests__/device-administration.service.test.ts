import { generateKeyPairSync } from "node:crypto"
import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import {
	AUDIT_EVENT_TYPE,
	approvalFingerprint,
	DEVICE_STATE,
	type LoginMethodOverrides,
	PERMISSIONS,
	type PublicKeyJwk,
	SESSION_END_REASON,
} from "@ansora/core-server"
import { describe, expect, it } from "vitest"
import type { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import type { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import type { ConfigurationService } from "../../configuration/services/configuration.service"
import type { LoginMethodOverridesRepository } from "../../effective-configuration/repositories/login-method-overrides.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { DeviceGroupCodeTakenError } from "../errors/device-group-code-taken.error"
import type { DeviceAdministrationRepository } from "../repositories/device-administration.repository"
import type { DeviceGroupRepository } from "../repositories/device-group.repository"
import { DeviceAdministrationService } from "../services/device-administration.service"
import { DeviceSessionsService } from "../services/device-sessions.service"
import type {
	DeviceDetailRow,
	DeviceGroupRow,
	DeviceUnblocking,
	EndedSessionRow,
	NewDeviceGroup,
} from "../types/device-administration.types"

const ADMINISTRATOR: AdministrationSession = {
	sessionId: "99999999-9999-4999-8999-999999999999",
	userId: "11111111-1111-4111-8111-111111111111",
	permissions: PERMISSIONS,
}
const REQUESTER = "22222222-2222-4222-8222-222222222222"
const DEVICE_ID = "33333333-3333-4333-8333-333333333333"
const GROUP_ID = "44444444-4444-4444-8444-444444444444"

function deviceKey(): PublicKeyJwk {
	const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" })
	const exported = publicKey.export({ format: "jwk" })
	return { kty: "EC", crv: "P-256", x: exported.x as string, y: exported.y as string }
}

function deviceRow(overrides: Partial<DeviceDetailRow> = {}): DeviceDetailRow {
	return {
		id: DEVICE_ID,
		state: DEVICE_STATE.PENDING_APPROVAL,
		public_key_jwk: deviceKey(),
		hw_id: "hw-1",
		model: "iPhone15,2",
		os_version: "18.5",
		platform: "ios",
		managed_configuration: false,
		group_code: null,
		blocked_predecessor_hw_id: null,
		last_contact_at: null,
		login_methods: {},
		registered_at: new Date("2026-09-22T08:00:00Z"),
		queue_waiting_count: null,
		queue_failed_count: null,
		queue_oldest_acquired_at: null,
		queue_detected_at: null,
		queue_reported_at: null,
		blocking_detected_at: null,
		blocking_signals: null,
		blocking_app_version: null,
		unblocked_at: null,
		unblocked_by_user_id: null,
		unblock_reason: null,
		predecessor_id: null,
		predecessor_blocking_detected_at: null,
		predecessor_blocking_signals: null,
		predecessor_blocking_app_version: null,
		...overrides,
	}
}

interface Harness {
	service: DeviceAdministrationService
	audited: NewAuditEvent[]
	states: string[]
	groups: string[]
	group: () => DeviceGroupRow
	groupReads: string[]
}

function harnessWith(
	row: DeviceDetailRow,
	knownGroups: string[] = [],
	stateAtLock: DeviceDetailRow["state"] | undefined = undefined,
	openSessions: EndedSessionRow[] = [],
): Harness {
	const audited: NewAuditEvent[] = []
	const states: string[] = []
	const groups: string[] = []
	const groupReads: string[] = []
	let current = row
	let groupRow: DeviceGroupRow = {
		id: GROUP_ID,
		code: "ambulance",
		name: "Ambulance",
		login_methods: {},
		device_count: "2",
	}
	const repository = {
		find: async () => current,
		lockState: async () => stateAtLock ?? current.state,
		endSessionsOf: async () => openSessions.splice(0),
		changeState: async (_tx: never, _id: string, state: string) => {
			states.push(state)
			current = { ...current, state: state as DeviceDetailRow["state"] }
		},
		unblock: async (_tx: never, _id: string, unblocking: DeviceUnblocking) => {
			if (current.unblocked_at !== null) {
				return false
			}
			current = {
				...current,
				unblocked_at: unblocking.unblockedAt,
				unblocked_by_user_id: unblocking.administratorUserId,
				unblock_reason: unblocking.reason,
			}
			return true
		},
		assignGroup: async (_tx: never, _id: string, code: string) => {
			groups.push(code)
			current = { ...current, group_code: code }
		},
		setDeviceLoginMethods: async (_tx: never, _id: string, overrides: LoginMethodOverrides) => {
			current = { ...current, login_methods: overrides }
		},
		setGroupLoginMethods: async (_tx: never, _id: string, overrides: LoginMethodOverrides) => {
			groupRow = { ...groupRow, login_methods: overrides }
		},
		renameGroup: async (_tx: never, _id: string, name: string) => {
			groupRow = { ...groupRow, name }
		},
		insertGroup: async (_tx: never, group: NewDeviceGroup) => {
			if (knownGroups.includes(group.code)) {
				throw new DeviceGroupCodeTakenError(group.code)
			}
			groupRow = {
				id: GROUP_ID,
				code: group.code,
				name: group.name,
				login_methods: group.loginMethods,
				device_count: "0",
			}
			return GROUP_ID
		},
		findGroup: async () => groupRow,
		page: async () => ({ rows: [current], hasMore: false }),
		groupLoginMethods: async () => {
			groupReads.push(groupRow.code)
			return new Map([[groupRow.code, groupRow.login_methods]])
		},
		devicesWithOverrides: async () =>
			current.login_methods.card === undefined
				? []
				: [{ id: DEVICE_ID, hw_id: current.hw_id, login_methods: current.login_methods }],
		clearDeviceOverrides: async (_tx: never, _code: string) => {
			current = { ...current, login_methods: {} }
		},
	} as unknown as DeviceAdministrationRepository
	const database = {
		sql: { begin: async (work: (tx: never) => Promise<unknown>) => work({} as never) },
	} as unknown as DatabaseService
	const configuration = {
		pageSize: async () => ({ defaultSize: 50, maxSize: 500 }),
		values: async () =>
			new Map<string, unknown>([
				["login_methods.card", true],
				["login_methods.qr", true],
				["login_methods.barcode", true],
				["login_methods.pin", false],
			]),
	} as unknown as ConfigurationService
	const groupOverrides = { ofGroup: async () => groupRow.login_methods } as unknown as LoginMethodOverridesRepository
	const deviceGroups = {
		exists: async (code: string) => knownGroups.includes(code),
	} as unknown as DeviceGroupRepository
	const audit = {
		append: async (_tx: never, event: NewAuditEvent) => {
			audited.push(event)
			return undefined as never
		},
	} as unknown as AuditRepository
	return {
		service: new DeviceAdministrationService(
			database,
			repository,
			deviceGroups,
			configuration,
			groupOverrides,
			audit,
			new DeviceSessionsService(repository, audit),
		),
		audited,
		states,
		groups,
		group: () => groupRow,
		groupReads,
	}
}

describe("DeviceAdministrationService", () => {
	it("CAP-006-S08 approves a pending device when the fingerprint read on it matches", async () => {
		const row = deviceRow()
		const { service, audited, states } = harnessWith(row)

		const device = await service.approve(
			DEVICE_ID,
			{ fingerprint: approvalFingerprint(row.public_key_jwk), requester_user_id: REQUESTER },
			ADMINISTRATOR,
		)

		expect(states).toEqual([DEVICE_STATE.APPROVED])
		expect(device.state).toBe(DEVICE_STATE.APPROVED)
		expect(audited).toHaveLength(1)
		expect(audited[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.DEVICE_APPROVAL,
			actorUserId: ADMINISTRATOR.userId,
			objectId: DEVICE_ID,
			details: { requester_user_id: REQUESTER, administrator_user_id: ADMINISTRATOR.userId },
		})
	})

	it("CAP-012-S27 lets a device override the group and records who changed it", async () => {
		const { service, audited } = harnessWith(deviceRow({ group_code: "ambulance" }))

		const saved = await service.setDeviceLoginMethods(DEVICE_ID, { card: false, pin: true }, ADMINISTRATOR)

		expect(saved.effective_login_methods).toEqual(
			expect.arrayContaining([
				{ method: "card", enabled: false, source: "device" },
				{ method: "pin", enabled: true, source: "device" },
				{ method: "qr", enabled: true, source: "installation" },
				{ method: "oidc", enabled: true, source: "installation" },
			]),
		)
		expect(saved.warnings).toEqual([])
		expect(audited[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED,
			objectId: DEVICE_ID,
			details: { level: "device", administrator_user_id: ADMINISTRATOR.userId },
		})
	})

	it("CAP-012-S28 accepts a device left without a quick method and warns about it", async () => {
		const { service } = harnessWith(deviceRow())

		const saved = await service.setDeviceLoginMethods(
			DEVICE_ID,
			{ card: false, qr: false, barcode: false, pin: false },
			ADMINISTRATOR,
		)

		expect(saved.warnings).toEqual([expect.objectContaining({ code: "all_quick_login_methods_disabled" })])
	})

	it("CAP-012-S29 applies a group setting and clears the overrides of its devices", async () => {
		const { service, audited } = harnessWith(deviceRow({ group_code: "ambulance", login_methods: { card: true } }))

		const saved = await service.applyGroupLoginMethods(
			GROUP_ID,
			{ login_methods: { card: false }, clear_device_overrides: true },
			ADMINISTRATOR,
		)

		expect(saved.cleared_device_override_count).toBe(1)
		expect(saved.effective_login_methods).toEqual(
			expect.arrayContaining([{ method: "card", enabled: false, source: "group" }]),
		)
		expect(audited.map((event) => event.eventType)).toEqual([
			AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED,
			AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED,
		])
		expect(audited[0]).toMatchObject({
			objectId: GROUP_ID,
			details: { level: "group", previous_login_methods: {}, login_methods: { card: false } },
		})
		expect(audited[1]).toMatchObject({
			objectId: DEVICE_ID,
			details: { level: "device", group_code: "ambulance", previous_login_methods: { card: true }, login_methods: {} },
		})
	})

	it("CAP-006-S09 refuses a fingerprint that does not match and leaves the device waiting", async () => {
		const { service, audited, states } = harnessWith(deviceRow())

		await expect(
			service.approve(DEVICE_ID, { fingerprint: "K7Q2M-9XR4T", requester_user_id: REQUESTER }, ADMINISTRATOR),
		).rejects.toMatchObject({ code: ADMINISTRATION_ERROR_CODE.FINGERPRINT_MISMATCH })
		expect(states).toEqual([])
		expect(audited[0]).toMatchObject({ eventType: AUDIT_EVENT_TYPE.DEVICE_APPROVAL_REJECTED, outcome: "failure" })
	})

	it("CAP-006-S14 refuses to approve a device that is not waiting", async () => {
		const row = deviceRow({ state: DEVICE_STATE.REVOKED })
		const { service } = harnessWith(row)

		await expect(
			service.approve(
				DEVICE_ID,
				{ fingerprint: approvalFingerprint(row.public_key_jwk), requester_user_id: REQUESTER },
				ADMINISTRATOR,
			),
		).rejects.toBeInstanceOf(ProblemException)
	})

	it("CAP-006-S14 revokes a waiting device and audits it as a revocation", async () => {
		const { service, audited, states } = harnessWith(deviceRow())

		const device = await service.revoke(DEVICE_ID, ADMINISTRATOR)

		expect(states).toEqual([DEVICE_STATE.REVOKED])
		expect(device.state).toBe(DEVICE_STATE.REVOKED)
		expect(audited[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.DEVICE_REVOCATION,
			details: { previous_state: DEVICE_STATE.PENDING_APPROVAL },
		})
	})

	it("CAP-002-S09 ends the user session and the device token of the revoked device", async () => {
		const sessions = [
			{ id: "66666666-6666-4666-8666-666666666666", user_id: REQUESTER },
			{ id: "77777777-7777-4777-8777-777777777777", user_id: null },
		]
		const { service, audited } = harnessWith(deviceRow({ state: DEVICE_STATE.APPROVED }), [], undefined, sessions)

		await service.revoke(DEVICE_ID, ADMINISTRATOR)

		expect(audited).toMatchObject([
			{ eventType: AUDIT_EVENT_TYPE.DEVICE_REVOCATION },
			{
				eventType: AUDIT_EVENT_TYPE.SESSION_TERMINATION,
				actorUserId: REQUESTER,
				actorDeviceId: DEVICE_ID,
				sessionId: "66666666-6666-4666-8666-666666666666",
				details: { reason: SESSION_END_REASON.DEVICE_REVOKED },
			},
		])
	})

	it("CAP-007-R08 leaves a revoked device and the audit as they are when it is revoked again", async () => {
		const { service, audited, states } = harnessWith(deviceRow({ state: DEVICE_STATE.REVOKED }))

		const device = await service.revoke(DEVICE_ID, ADMINISTRATOR)

		expect(device.state).toBe(DEVICE_STATE.REVOKED)
		expect(states).toEqual([])
		expect(audited).toEqual([])
	})

	it("CAP-007-R08 audits the state the device had when the revocation locked it", async () => {
		const { service, audited } = harnessWith(deviceRow(), [], DEVICE_STATE.APPROVED)

		await service.revoke(DEVICE_ID, ADMINISTRATOR)

		expect(audited[0]).toMatchObject({ details: { previous_state: DEVICE_STATE.APPROVED } })
	})

	it("CAP-006-R20 does not approve a device another administrator revoked in the meantime", async () => {
		const row = deviceRow()
		const { service, audited, states } = harnessWith(row, [], DEVICE_STATE.REVOKED)

		await expect(
			service.approve(
				DEVICE_ID,
				{ fingerprint: approvalFingerprint(row.public_key_jwk), requester_user_id: REQUESTER },
				ADMINISTRATOR,
			),
		).rejects.toMatchObject({ code: ADMINISTRATION_ERROR_CODE.DEVICE_NOT_PENDING })
		expect(states).toEqual([])
		expect(audited).toEqual([])
	})

	it("CAP-008-S09 shows the administrator what the blocked device reported", async () => {
		const row = deviceRow({
			state: DEVICE_STATE.BLOCKED,
			blocking_detected_at: new Date("2026-10-29T08:00:00.000Z"),
			blocking_signals: ["root", "debugger"],
			blocking_app_version: "1.0.0",
		})
		const { service } = harnessWith(row)

		const device = await service.detail(DEVICE_ID)

		expect(device.blocking).toEqual({
			detected_at: "2026-10-29T08:00:00.000Z",
			signals: ["root", "debugger"],
			app_version: "1.0.0",
		})
		expect(device.unblocking).toBeNull()
	})

	it("CAP-007-S07 unblocks a blocked device, keeps its state and audits the review", async () => {
		const { service, audited, states } = harnessWith(deviceRow({ state: DEVICE_STATE.BLOCKED }))

		const device = await service.unblock(DEVICE_ID, { reason: "Falešný poplach, MDM ověřeno." }, ADMINISTRATOR)

		expect(states).toEqual([])
		expect(device.state).toBe(DEVICE_STATE.BLOCKED)
		expect(device.unblocking).toMatchObject({
			unblocked_by_user_id: ADMINISTRATOR.userId,
			reason: "Falešný poplach, MDM ověřeno.",
		})
		expect(audited).toEqual([
			{
				eventType: AUDIT_EVENT_TYPE.DEVICE_UNBLOCKING,
				actorKind: "user",
				actorUserId: ADMINISTRATOR.userId,
				objectId: DEVICE_ID,
				outcome: "success",
				details: {
					administrator_user_id: ADMINISTRATOR.userId,
					hw_id: "hw-1",
					previous_state: DEVICE_STATE.BLOCKED,
					reason: "Falešný poplach, MDM ověřeno.",
				},
			},
		])
	})

	it("CAP-007-S07 unblocks a revoked device too", async () => {
		const { service, audited } = harnessWith(deviceRow({ state: DEVICE_STATE.REVOKED }))

		const device = await service.unblock(DEVICE_ID, { reason: "Zařízení nalezeno." }, ADMINISTRATOR)

		expect(device.unblocking).not.toBeNull()
		expect(audited[0]).toMatchObject({ details: { previous_state: DEVICE_STATE.REVOKED } })
	})

	it("CAP-007-S07 changes and audits nothing when the device is unblocked again", async () => {
		const unblockedAt = new Date("2026-10-29T09:00:00.000Z")
		const row = deviceRow({
			state: DEVICE_STATE.BLOCKED,
			unblocked_at: unblockedAt,
			unblocked_by_user_id: ADMINISTRATOR.userId,
			unblock_reason: "První přezkoumání.",
		})
		const { service, audited } = harnessWith(row)

		const device = await service.unblock(DEVICE_ID, { reason: "Druhé přezkoumání." }, ADMINISTRATOR)

		expect(device.unblocking).toEqual({
			unblocked_at: unblockedAt.toISOString(),
			unblocked_by_user_id: ADMINISTRATOR.userId,
			reason: "První přezkoumání.",
		})
		expect(audited).toEqual([])
	})

	it("CAP-007-S07 refuses to unblock a device that is neither blocked nor revoked", async () => {
		const { service, audited } = harnessWith(deviceRow({ state: DEVICE_STATE.APPROVED }))

		await expect(service.unblock(DEVICE_ID, { reason: "Omyl." }, ADMINISTRATOR)).rejects.toMatchObject({
			code: ADMINISTRATION_ERROR_CODE.DEVICE_NOT_BLOCKED,
		})
		expect(audited).toEqual([])
	})

	it("CAP-007-S07 judges the state the device had when the unblocking locked it", async () => {
		const { service } = harnessWith(deviceRow({ state: DEVICE_STATE.BLOCKED }), [], DEVICE_STATE.APPROVED)

		await expect(service.unblock(DEVICE_ID, { reason: "Omyl." }, ADMINISTRATOR)).rejects.toMatchObject({
			code: ADMINISTRATION_ERROR_CODE.DEVICE_NOT_BLOCKED,
		})
	})

	it("CAP-006-S13 shows the blocked predecessor and its review with the new registration", async () => {
		const predecessorId = "55555555-5555-4555-8555-555555555555"
		const row = deviceRow({
			blocked_predecessor_hw_id: "hw-blocked",
			predecessor_id: predecessorId,
			predecessor_blocking_detected_at: new Date("2026-10-29T08:00:00.000Z"),
			predecessor_blocking_signals: ["magisk"],
			predecessor_blocking_app_version: "1.0.0",
		})
		const { service } = harnessWith(row)

		const device = await service.detail(DEVICE_ID)

		expect(device.blocked_predecessor).toEqual({
			hw_id: "hw-blocked",
			device_id: predecessorId,
			blocking: { detected_at: "2026-10-29T08:00:00.000Z", signals: ["magisk"], app_version: "1.0.0" },
		})
	})

	it("CAP-006-R19 keeps the reported predecessor when the server does not know it", async () => {
		const { service } = harnessWith(deviceRow({ blocked_predecessor_hw_id: "hw-unknown" }))

		const device = await service.detail(DEVICE_ID)

		expect(device.blocked_predecessor).toEqual({ hw_id: "hw-unknown", device_id: null, blocking: null })
	})

	it("CAP-006-S11 moves a device to another group and audits both codes", async () => {
		const { service, audited, groups } = harnessWith(deviceRow({ group_code: "ambulance" }), ["wards"])

		const device = await service.assignGroup(DEVICE_ID, "wards", ADMINISTRATOR)

		expect(groups).toEqual(["wards"])
		expect(device.group_code).toBe("wards")
		expect(audited[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.DEVICE_ASSIGNED_TO_GROUP,
			details: { previous_group_code: "ambulance", group_code: "wards" },
		})
	})

	it("refuses an unknown group code", async () => {
		const { service, groups } = harnessWith(deviceRow())

		await expect(service.assignGroup(DEVICE_ID, "nowhere", ADMINISTRATOR)).rejects.toThrow()
		expect(groups).toEqual([])
	})

	it("CAP-006-S09 never returns the approval fingerprint of a waiting device", async () => {
		const row = deviceRow()
		const { service } = harnessWith(row)

		const device = await service.detail(DEVICE_ID)

		expect(JSON.stringify(device)).not.toContain(approvalFingerprint(row.public_key_jwk))
		expect(device.effective_login_methods).toEqual([
			{ method: "oidc", enabled: true, source: "installation" },
			{ method: "card", enabled: true, source: "installation" },
			{ method: "qr", enabled: true, source: "installation" },
			{ method: "barcode", enabled: true, source: "installation" },
			{ method: "pin", enabled: false, source: "installation" },
		])
	})

	it("CAP-012-S28 creates a group without quick methods, audits its setting and warns about it", async () => {
		const { service, audited, group } = harnessWith(deviceRow())

		const saved = await service.createGroup(
			{
				code: "phones",
				name: "Soukromé telefony",
				login_methods: { card: false, qr: false, barcode: false, pin: false },
			},
			ADMINISTRATOR,
		)

		expect(group().login_methods).toEqual({ card: false, qr: false, barcode: false, pin: false })
		expect(saved.warnings).toEqual([expect.objectContaining({ code: "all_quick_login_methods_disabled" })])
		expect(audited).toHaveLength(1)
		expect(audited[0]).toMatchObject({
			eventType: AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED,
			objectId: GROUP_ID,
			details: { level: "group", group_code: "phones", administrator_user_id: ADMINISTRATOR.userId },
		})
	})

	it("creates a group that inherits everything without an audit of login methods", async () => {
		const { service, audited, group } = harnessWith(deviceRow())

		const saved = await service.createGroup(
			{ code: "wards", name: "Oddělení", login_methods: { card: null, qr: null, pin: null } },
			ADMINISTRATOR,
		)

		expect(group().login_methods).toEqual({})
		expect(saved.warnings).toEqual([])
		expect(audited).toEqual([])
	})

	it("refuses a second group with the same code", async () => {
		const { service } = harnessWith(deviceRow(), ["wards"])

		await expect(service.createGroup({ code: "wards", name: "Oddělení" }, ADMINISTRATOR)).rejects.toMatchObject({
			code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE,
		})
	})

	it("renames a group and keeps its login methods when the body leaves them out", async () => {
		const { service, audited, group } = harnessWith(deviceRow())
		await service.applyGroupLoginMethods(
			GROUP_ID,
			{ login_methods: { qr: false }, clear_device_overrides: false },
			ADMINISTRATOR,
		)
		audited.length = 0

		const saved = await service.updateGroup(GROUP_ID, { code: "ambulance", name: "Ambulance B" }, ADMINISTRATOR)

		expect(saved.name).toBe("Ambulance B")
		expect(group().login_methods).toEqual({ qr: false })
		expect(audited).toEqual([])
	})

	it("audits a changed group override with the group level", async () => {
		const { service, audited } = harnessWith(deviceRow())

		const saved = await service.updateGroup(
			GROUP_ID,
			{ code: "ambulance", name: "Ambulance", login_methods: { card: false } },
			ADMINISTRATOR,
		)

		expect(saved.effective_login_methods).toEqual(
			expect.arrayContaining([{ method: "card", enabled: false, source: "group" }]),
		)
		expect(audited[0]).toMatchObject({
			objectId: GROUP_ID,
			details: { level: "group", previous_login_methods: {}, login_methods: { card: false } },
		})
	})

	it("refuses to change the code of a group", async () => {
		const { service, group } = harnessWith(deviceRow())

		await expect(
			service.updateGroup(GROUP_ID, { code: "elsewhere", name: "Ambulance" }, ADMINISTRATOR),
		).rejects.toMatchObject({ code: ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE })
		expect(group().code).toBe("ambulance")
	})

	it("stores only the methods a device sets and not the inherited ones", async () => {
		const { service, audited } = harnessWith(deviceRow())

		const saved = await service.setDeviceLoginMethods(DEVICE_ID, { card: null, qr: false, pin: null }, ADMINISTRATOR)

		expect(saved.login_methods).toEqual({ qr: false })
		expect(audited[0]).toMatchObject({ details: { previous_login_methods: {}, login_methods: { qr: false } } })
	})

	it("lists devices with the login methods of their group read once for the whole page", async () => {
		const { service, groupReads } = harnessWith(deviceRow({ group_code: "ambulance" }))
		await service.applyGroupLoginMethods(
			GROUP_ID,
			{ login_methods: { qr: false }, clear_device_overrides: false },
			ADMINISTRATOR,
		)

		const page = await service.list({})

		expect(groupReads).toEqual(["ambulance"])
		expect(page.items?.[0]?.effective_login_methods).toEqual(
			expect.arrayContaining([{ method: "qr", enabled: false, source: "group" }]),
		)
	})
})
