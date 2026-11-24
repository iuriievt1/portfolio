import {
	APP_VERSION_HEADER,
	BLOCKING_APP_VERSION_MAX_LENGTH,
	ERROR_CODE,
	type IntegrityReport,
} from "@ansora/contracts"
import {
	AUDIT_ACTOR_KIND,
	AUDIT_EVENT_TYPE,
	AUDIT_OUTCOME,
	appVersionOfHeader,
	DEVICE_STATE,
	type DeviceState,
} from "@ansora/core-server"
import { HttpStatus, Injectable } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import type { Request } from "express"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { DeviceAdministrationRepository } from "../repositories/device-administration.repository"
import type { DeviceBlocking } from "../types/device-administration.types"
import { DeviceProofService } from "./device-proof.service"
import { DeviceSessionsService } from "./device-sessions.service"

@Injectable()
export class DeviceIntegrityService {
	constructor(
		private readonly database: DatabaseService,
		private readonly proofs: DeviceProofService,
		private readonly devices: DeviceAdministrationRepository,
		private readonly audit: AuditRepository,
		private readonly sessions: DeviceSessionsService,
	) {}

	// CAP-008-R05, CAP-008-R09, CAP-008-R12, CAP-008-S07, CAP-025-R16
	async report(request: Request, report: IntegrityReport): Promise<void> {
		const { device } = await this.proofs.ofKnownDevice(request)
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => {
			const previousState = await this.devices.lockState(tx, device.id)
			if (previousState === undefined || previousState === DEVICE_STATE.BLOCKED) {
				return
			}
			// procesy-a-stavy.md 2.1, CAP-007-R11
			if (previousState === DEVICE_STATE.REVOKED) {
				throw new ProblemException(HttpStatus.FORBIDDEN, ERROR_CODE.DEVICE_REVOKED)
			}
			const blocking = {
				detectedAt: report.detected_at,
				signals: report.signals,
				appVersion: reportedAppVersion(request),
			}
			await this.devices.block(tx, device.id, blocking)
			await this.audit.append(tx, blockingEvent(device.id, previousState, blocking, report.unsent_items))
			await this.sessions.endAll(tx, device.id)
		})
	}
}

// CAP-008-R12, index.yaml AppVersion
function reportedAppVersion(request: Request): string {
	const version = appVersionOfHeader(request.header(APP_VERSION_HEADER) ?? "")
	if (version === undefined || version.length > BLOCKING_APP_VERSION_MAX_LENGTH) {
		throw new ProblemException(HttpStatus.BAD_REQUEST, ERROR_CODE.RECORD_REJECTED, "the app version is out of range")
	}
	return version
}

// CAP-008-R09, CAP-025-R16, administration.yaml AuditRecord device-blocking
function blockingEvent(
	deviceId: string,
	previousState: DeviceState,
	blocking: DeviceBlocking,
	unsentItems: IntegrityReport["unsent_items"],
): NewAuditEvent {
	return {
		eventType: AUDIT_EVENT_TYPE.DEVICE_BLOCKING,
		actorKind: AUDIT_ACTOR_KIND.DEVICE,
		actorDeviceId: deviceId,
		objectId: deviceId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			previous_state: previousState,
			signals: [...blocking.signals],
			detected_at: blocking.detectedAt,
			app_version: blocking.appVersion,
			unsent_items: { count: unsentItems.count, oldest_acquired_at: unsentItems.oldest_acquired_at },
		},
	}
}
