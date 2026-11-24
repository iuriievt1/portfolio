import { ADMINISTRATION_ERROR_CODE, CONFIGURATION_WARNING } from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	type AuditEventType,
	type AuditOutcome,
	approvalFingerprint,
	DEVICE_STATE,
	type ExplicitOverrides,
	effectiveLoginMethods,
	explicitOverrides,
	hasNoQuickLoginMethod,
	type JsonObject,
	LOGIN_METHOD_SOURCE,
	type LoginMethodOverrides,
	sameOverrides,
} from "@ansora/core-server"
import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { CONFIGURATION_WARNING_MESSAGE } from "../../configuration/constants/configuration-warning.constants"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { LoginMethodOverridesRepository } from "../../effective-configuration/repositories/login-method-overrides.repository"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import type { DeviceApprovalInput } from "../dto/device-approval.input.dto"
import type { DeviceGroupInput } from "../dto/device-group.input.dto"
import type { DevicePageInput } from "../dto/device-page.input.dto"
import type { DeviceUnblockingInput } from "../dto/device-unblocking.input.dto"
import type { GroupLoginMethodsInput, LoginMethodOverridesInput } from "../dto/login-methods.input.dto"
import { DeviceGroupCodeTakenError } from "../errors/device-group-code-taken.error"
import { DeviceAdministrationRepository, encodeCursor } from "../repositories/device-administration.repository"
import { DeviceGroupRepository } from "../repositories/device-group.repository"
import type {
	BlockingReviewView,
	DeviceDetailRow,
	DeviceGroupRow,
	DeviceGroupSaveResult,
	DeviceGroupView,
	DeviceOverridesRow,
	DeviceSaveResult,
	DevicesPage,
	DeviceView,
	NewDeviceGroup,
} from "../types/device-administration.types"
import { deviceQueueOf } from "../utils/device-queue-view"
import { DeviceSessionsService } from "./device-sessions.service"

@Injectable()
export class DeviceAdministrationService {
	constructor(
		private readonly database: DatabaseService,
		private readonly devices: DeviceAdministrationRepository,
		private readonly deviceGroups: DeviceGroupRepository,
		private readonly configuration: ConfigurationService,
		private readonly overrides: LoginMethodOverridesRepository,
		private readonly audit: AuditRepository,
		private readonly sessions: DeviceSessionsService,
	) {}

	async list(query: DevicePageInput): Promise<DevicesPage> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const page = await this.devices.page({ limit, cursor: query.cursor, state: query.state })
		const installation = await this.installationMethods()
		const groups = await this.devices.groupLoginMethods()
		const items = page.rows.map((row) =>
			deviceView(row, installation, row.group_code === null ? {} : (groups.get(row.group_code) ?? {})),
		)
		const last = page.rows.at(-1)
		return { items, next_cursor: page.hasMore && last !== undefined ? encodeCursor(last) : null }
	}

	async detail(id: string): Promise<DeviceView> {
		const row = await this.device(id)
		return deviceView(row, await this.installationMethods(), await this.overrides.ofGroup(row.group_code))
	}

	async approve(id: string, approval: DeviceApprovalInput, administrator: AdministrationSession): Promise<DeviceView> {
		const device = await this.device(id)
		if (device.state !== DEVICE_STATE.PENDING_APPROVAL) {
			throw deviceNotPending()
		}
		const expected = approvalFingerprint(device.public_key_jwk)
		if (approval.fingerprint !== expected) {
			await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				await this.audit.append(
					tx,
					deviceEvent(AUDIT_EVENT_TYPE.DEVICE_APPROVAL_REJECTED, AUDIT_OUTCOME.FAILURE, device, administrator, {
						requester_user_id: approval.requester_user_id,
					}),
				)
			})
			throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.FINGERPRINT_MISMATCH)
		}
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			// CAP-006-R20
			if ((await this.devices.lockState(tx, id)) !== DEVICE_STATE.PENDING_APPROVAL) {
				throw deviceNotPending()
			}
			await this.devices.changeState(tx, id, DEVICE_STATE.APPROVED)
			await this.audit.append(
				tx,
				deviceEvent(AUDIT_EVENT_TYPE.DEVICE_APPROVAL, AUDIT_OUTCOME.SUCCESS, device, administrator, {
					fingerprint: approval.fingerprint,
					requester_user_id: approval.requester_user_id,
					blocked_predecessor_hw_id: device.blocked_predecessor_hw_id,
				}),
			)
		})
		return await this.detail(id)
	}

	// CAP-007-R08
	async revoke(id: string, administrator: AdministrationSession): Promise<DeviceView> {
		const device = await this.device(id)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const previousState = await this.devices.lockState(tx, id)
			if (previousState === undefined || previousState === DEVICE_STATE.REVOKED) {
				return
			}
			await this.devices.changeState(tx, id, DEVICE_STATE.REVOKED)
			await this.audit.append(
				tx,
				deviceEvent(AUDIT_EVENT_TYPE.DEVICE_REVOCATION, AUDIT_OUTCOME.SUCCESS, device, administrator, {
					previous_state: previousState,
				}),
			)
			await this.sessions.endAll(tx, id)
		})
		return await this.detail(id)
	}

	// CAP-007-R06, CAP-007-R07, CAP-007-S07, CAP-008-R07
	async unblock(id: string, input: DeviceUnblockingInput, administrator: AdministrationSession): Promise<DeviceView> {
		const device = await this.device(id)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const previousState = await this.devices.lockState(tx, id)
			if (previousState !== DEVICE_STATE.BLOCKED && previousState !== DEVICE_STATE.REVOKED) {
				throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.DEVICE_NOT_BLOCKED)
			}
			const unblocking = { unblockedAt: new Date(), administratorUserId: administrator.userId, reason: input.reason }
			if (!(await this.devices.unblock(tx, id, unblocking))) {
				return
			}
			await this.audit.append(
				tx,
				deviceEvent(AUDIT_EVENT_TYPE.DEVICE_UNBLOCKING, AUDIT_OUTCOME.SUCCESS, device, administrator, {
					previous_state: previousState,
					reason: input.reason,
				}),
			)
		})
		return await this.detail(id)
	}

	async assignGroup(id: string, groupCode: string, administrator: AdministrationSession): Promise<DeviceView> {
		const device = await this.device(id)
		if (!(await this.deviceGroups.exists(groupCode))) {
			throw new NotFoundException()
		}
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.devices.assignGroup(tx, id, groupCode)
			await this.audit.append(
				tx,
				deviceEvent(AUDIT_EVENT_TYPE.DEVICE_ASSIGNED_TO_GROUP, AUDIT_OUTCOME.SUCCESS, device, administrator, {
					previous_group_code: device.group_code,
					group_code: groupCode,
				}),
			)
		})
		return await this.detail(id)
	}

	async groups(): Promise<DeviceGroupView[]> {
		const installation = await this.installationMethods()
		return (await this.devices.groups()).map((row) => groupView(row, installation))
	}

	async group(id: string): Promise<DeviceGroupView> {
		return groupView(await this.groupRow(id), await this.installationMethods())
	}

	// CAP-012-R26, CAP-012-R32
	async createGroup(input: DeviceGroupInput, administrator: AdministrationSession): Promise<DeviceGroupSaveResult> {
		const overrides = explicitOverrides(input.login_methods ?? {})
		const id = await this.insertGroup({ code: input.code, name: input.name, loginMethods: overrides }, administrator)
		return await this.savedGroup(id)
	}

	// CAP-012-R26, CAP-012-R32
	async updateGroup(
		id: string,
		input: DeviceGroupInput,
		administrator: AdministrationSession,
	): Promise<DeviceGroupSaveResult> {
		const group = await this.groupRow(id)
		if (input.code !== group.code) {
			throw new ProblemException(
				HttpStatus.UNPROCESSABLE_ENTITY,
				ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE,
				"the code of a device group does not change",
			)
		}
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			if (input.name !== group.name) {
				await this.devices.renameGroup(tx, id, input.name)
			}
			if (input.login_methods === undefined || sameOverrides(input.login_methods, group.login_methods)) {
				return
			}
			const overrides = explicitOverrides(input.login_methods)
			await this.devices.setGroupLoginMethods(tx, id, overrides)
			await this.audit.append(tx, groupChange(group, administrator, group.login_methods, overrides))
		})
		return await this.savedGroup(id)
	}

	async setDeviceLoginMethods(
		id: string,
		input: LoginMethodOverridesInput,
		administrator: AdministrationSession,
	): Promise<DeviceSaveResult> {
		const device = await this.device(id)
		const overrides = explicitOverrides(input)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.devices.setDeviceLoginMethods(tx, id, overrides)
			await this.audit.append(tx, deviceOverridesChange(device, administrator, overrides, device.group_code))
		})
		const view = await this.detail(id)
		return { ...view, warnings: warningsOf(view.effective_login_methods) }
	}

	async applyGroupLoginMethods(
		id: string,
		input: GroupLoginMethodsInput,
		administrator: AdministrationSession,
	): Promise<DeviceGroupSaveResult> {
		const group = await this.groupRow(id)
		const overrides = explicitOverrides(input.login_methods)
		const cleared = await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			await this.devices.setGroupLoginMethods(tx, id, overrides)
			await this.audit.append(tx, groupChange(group, administrator, group.login_methods, overrides))
			if (!input.clear_device_overrides) {
				return null
			}
			const devices = await this.devices.devicesWithOverrides(tx, group.code)
			await this.devices.clearDeviceOverrides(tx, group.code)
			for (const device of devices) {
				await this.audit.append(tx, deviceOverridesChange(device, administrator, {}, group.code))
			}
			return devices.length
		})
		return { ...(await this.savedGroup(id)), cleared_device_override_count: cleared }
	}

	private async insertGroup(group: NewDeviceGroup, administrator: AdministrationSession): Promise<string> {
		try {
			return await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
				const id = await this.devices.insertGroup(tx, group)
				if (Object.keys(group.loginMethods).length > 0) {
					await this.audit.append(tx, groupChange({ id, code: group.code }, administrator, {}, group.loginMethods))
				}
				return id
			})
		} catch (error) {
			if (error instanceof DeviceGroupCodeTakenError) {
				throw new ProblemException(
					HttpStatus.UNPROCESSABLE_ENTITY,
					ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE,
					"a device group with this code already exists",
				)
			}
			throw error
		}
	}

	private async savedGroup(id: string): Promise<DeviceGroupSaveResult> {
		const view = await this.group(id)
		return { ...view, warnings: warningsOf(view.effective_login_methods) }
	}

	private async device(id: string): Promise<DeviceDetailRow> {
		const device = await this.devices.find(id)
		if (device === undefined) {
			throw new NotFoundException()
		}
		return device
	}

	private async groupRow(id: string): Promise<DeviceGroupRow> {
		const group = await this.devices.findGroup(id)
		if (group === undefined) {
			throw new NotFoundException()
		}
		return group
	}

	private async installationMethods(): Promise<ReadonlyMap<string, unknown>> {
		return await this.configuration.values()
	}
}

function administrationEvent(
	administrator: AdministrationSession,
	eventType: AuditEventType,
	outcome: AuditOutcome,
	objectId: string,
	details: JsonObject,
): NewAuditEvent {
	return {
		eventType,
		actorKind: AUDIT_ACTOR_KIND.USER,
		actorUserId: administrator.userId,
		objectId,
		outcome,
		details: { administrator_user_id: administrator.userId, ...details },
	}
}

function deviceEvent(
	eventType: AuditEventType,
	outcome: AuditOutcome,
	device: DeviceDetailRow,
	administrator: AdministrationSession,
	details: JsonObject,
): NewAuditEvent {
	return administrationEvent(administrator, eventType, outcome, device.id, { hw_id: device.hw_id, ...details })
}

function deviceNotPending(): ProblemException {
	return new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.DEVICE_NOT_PENDING)
}

// CAP-012-R32
function groupChange(
	group: Pick<DeviceGroupRow, "id" | "code">,
	administrator: AdministrationSession,
	previous: LoginMethodOverrides,
	next: ExplicitOverrides,
): NewAuditEvent {
	return administrationEvent(administrator, AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED, AUDIT_OUTCOME.SUCCESS, group.id, {
		level: LOGIN_METHOD_SOURCE.GROUP,
		group_code: group.code,
		previous_login_methods: explicitOverrides(previous),
		login_methods: next,
	})
}

// CAP-012-R32
function deviceOverridesChange(
	device: DeviceOverridesRow,
	administrator: AdministrationSession,
	next: ExplicitOverrides,
	groupCode: string | null,
): NewAuditEvent {
	return administrationEvent(administrator, AUDIT_EVENT_TYPE.LOGIN_METHODS_CHANGED, AUDIT_OUTCOME.SUCCESS, device.id, {
		level: LOGIN_METHOD_SOURCE.DEVICE,
		hw_id: device.hw_id,
		group_code: groupCode,
		previous_login_methods: explicitOverrides(device.login_methods),
		login_methods: next,
	})
}

// CAP-012-R26
const NO_QUICK_METHOD_WARNING: DeviceSaveResult["warnings"][number] = {
	code: CONFIGURATION_WARNING.ALL_QUICK_LOGIN_METHODS_DISABLED,
	message: CONFIGURATION_WARNING_MESSAGE[CONFIGURATION_WARNING.ALL_QUICK_LOGIN_METHODS_DISABLED],
	keys: [],
}

function warningsOf(methods: DeviceView["effective_login_methods"]): DeviceSaveResult["warnings"] {
	return hasNoQuickLoginMethod(methods) ? [NO_QUICK_METHOD_WARNING] : []
}

function groupView(row: DeviceGroupRow, installation: ReadonlyMap<string, unknown>): DeviceGroupView {
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		login_methods: row.login_methods,
		device_count: Number(row.device_count),
		effective_login_methods: effectiveLoginMethods({ installation, group: row.login_methods }),
	}
}

function deviceView(
	row: DeviceDetailRow,
	installation: ReadonlyMap<string, unknown>,
	group: LoginMethodOverrides,
): DeviceView {
	return {
		id: row.id,
		hw_id: row.hw_id,
		model: row.model,
		os_version: row.os_version,
		is_mdm_managed: row.managed_configuration,
		group_code: row.group_code,
		state: row.state,
		login_methods: row.login_methods,
		effective_login_methods: effectiveLoginMethods({ installation, group, device: row.login_methods }),
		last_contact_at: row.last_contact_at?.toISOString(),
		queue: deviceQueueOf(row),
		blocking: blockingReviewOf(row.blocking_detected_at, row.blocking_signals, row.blocking_app_version),
		unblocking: unblockingOf(row),
		blocked_predecessor: blockedPredecessor(row),
	}
}

// CAP-008-R12, CAP-008-S09
function blockingReviewOf(
	detectedAt: Date | null,
	signals: BlockingReviewView["signals"] | null,
	appVersion: string | null,
): BlockingReviewView | null {
	if (detectedAt === null || signals === null || appVersion === null) {
		return null
	}
	return { detected_at: detectedAt.toISOString(), signals, app_version: appVersion }
}

// CAP-007-R06, CAP-007-S07
function unblockingOf(row: DeviceDetailRow): DeviceView["unblocking"] {
	if (row.unblocked_at === null || row.unblocked_by_user_id === null || row.unblock_reason === null) {
		return null
	}
	return {
		unblocked_at: row.unblocked_at.toISOString(),
		unblocked_by_user_id: row.unblocked_by_user_id,
		reason: row.unblock_reason,
	}
}

// CAP-006-R19, CAP-006-S13
function blockedPredecessor(row: DeviceDetailRow): DeviceView["blocked_predecessor"] {
	if (row.blocked_predecessor_hw_id === null) {
		return null
	}
	return {
		hw_id: row.blocked_predecessor_hw_id,
		device_id: row.predecessor_id,
		blocking: blockingReviewOf(
			row.predecessor_blocking_detected_at,
			row.predecessor_blocking_signals,
			row.predecessor_blocking_app_version,
		),
	}
}
