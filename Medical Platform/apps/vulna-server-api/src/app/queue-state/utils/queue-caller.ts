import type { Device } from "../../device/types/device.types"
import { QUEUE_CALLER } from "../constants/queue-state.constants"
import type { QueueCaller, QueueStateScope } from "../types/queue-state.types"

export function callerDeviceOf(caller: QueueCaller): Device {
	return caller.kind === QUEUE_CALLER.USER ? caller.current.device : caller.device
}

// CAP-019-R30, CAP-019-S22, CAP-019-S23
export function queueStateScopeOf(
	caller: QueueCaller,
	acquisitionKeys: readonly string[] | undefined,
): QueueStateScope {
	return {
		deviceId: callerDeviceOf(caller).id,
		operatorUserId: caller.kind === QUEUE_CALLER.USER ? caller.current.session.userId : undefined,
		acquisitionKeys,
	}
}
