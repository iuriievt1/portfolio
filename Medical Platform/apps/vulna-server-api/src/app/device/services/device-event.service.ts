import {
	DEVICE_EVENT_TYPE,
	type DeviceEvent,
	type DeviceEventBatch,
	type DeviceEventBatchReceipt,
} from "@ansora/contracts"
import { AUDIT_ACTOR_KIND, AUDIT_OUTCOME, DEVICE_STATE, type DeviceState } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import type { Request } from "express"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import type { NewAuditEvent } from "../../audit/types/audit.types"
import { RecordedDeviceEventRepository } from "../repositories/recorded-device-event.repository"
import { rejectionOfDeviceState } from "../utils/device-rejection"
import { DeviceProofService } from "./device-proof.service"

// CAP-025-R22, Z3
const REPORTING_AFTER_DELETION: ReadonlySet<DeviceState> = new Set([DEVICE_STATE.REVOKED, DEVICE_STATE.BLOCKED])

@Injectable()
export class DeviceEventService {
	constructor(
		private readonly database: DatabaseService,
		private readonly proofs: DeviceProofService,
		private readonly recorded: RecordedDeviceEventRepository,
		private readonly audit: AuditRepository,
	) {}

	// CAP-025-R22, CAP-007-R08, CAP-012-R24
	async record(request: Request, batch: DeviceEventBatch): Promise<DeviceEventBatchReceipt> {
		const { device } = await this.proofs.ofKnownDevice(request)
		const rejection = rejectionOfDeviceState(device.state)
		if (rejection !== undefined && !reportsDeletion(device.state, batch)) {
			throw rejection
		}
		const keys = batch.events.map((event) => event.idempotency_key)
		await this.database.sql.begin(async (tx) => {
			const recordedNow = await this.recorded.recordNew(tx, keys, device.id, new Date())
			for (const event of batch.events.filter((reported) => recordedNow.has(reported.idempotency_key.toLowerCase()))) {
				await this.audit.append(tx, auditEventOf(event, device.id))
			}
		})
		return { recorded_keys: keys }
	}
}

function reportsDeletion(state: DeviceState, batch: DeviceEventBatch): boolean {
	return (
		REPORTING_AFTER_DELETION.has(state) &&
		batch.events.some((event) => event.type === DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION)
	)
}

// datovy-model.md 8, administration.yaml AuditRecord originated_on_device_at
function auditEventOf(event: DeviceEvent, deviceId: string): NewAuditEvent {
	const reported: NewAuditEvent = {
		eventType: event.type,
		actorKind: AUDIT_ACTOR_KIND.DEVICE,
		actorDeviceId: deviceId,
		outcome: AUDIT_OUTCOME.SUCCESS,
		details: {
			originated_at: event.originated_at,
			idempotency_key: event.idempotency_key,
			event_details: { ...event.details },
		},
	}
	if (event.user_id === null) {
		return reported
	}
	return { ...reported, actorKind: AUDIT_ACTOR_KIND.USER, actorUserId: event.user_id }
}
