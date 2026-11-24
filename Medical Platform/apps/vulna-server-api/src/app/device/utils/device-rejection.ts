import { ERROR_CODE, type ErrorCode } from "@ansora/contracts"
import { DEVICE_STATE, type DeviceState } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"
import { ProblemException } from "../../infra/exceptions/problem.exception"

const DEVICE_REJECTION: Partial<Record<DeviceState, { status: HttpStatus; code: ErrorCode }>> = {
	[DEVICE_STATE.REVOKED]: { status: HttpStatus.FORBIDDEN, code: ERROR_CODE.DEVICE_REVOKED },
	[DEVICE_STATE.BLOCKED]: { status: HttpStatus.FORBIDDEN, code: ERROR_CODE.DEVICE_BLOCKED },
	[DEVICE_STATE.PENDING_APPROVAL]: { status: HttpStatus.FORBIDDEN, code: ERROR_CODE.DEVICE_PENDING_APPROVAL },
}

export function rejectionOfDeviceState(state: DeviceState): ProblemException | undefined {
	const rejection = DEVICE_REJECTION[state]
	return rejection === undefined ? undefined : new ProblemException(rejection.status, rejection.code)
}
