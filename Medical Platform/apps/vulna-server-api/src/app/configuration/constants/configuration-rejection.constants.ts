import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import type { ConfigurationRejectionCode } from "@ansora/core-server"
import { HttpStatus } from "@nestjs/common"

export const CONFIGURATION_REJECTION_STATUS: Record<ConfigurationRejectionCode, HttpStatus> = {
	[ADMINISTRATION_ERROR_CODE.VERSION_CONFLICT]: HttpStatus.CONFLICT,
	[ADMINISTRATION_ERROR_CODE.VALUE_OUT_OF_RANGE]: HttpStatus.UNPROCESSABLE_ENTITY,
	[ADMINISTRATION_ERROR_CODE.DEFAULT_LANGUAGE_NOT_SUPPORTED]: HttpStatus.UNPROCESSABLE_ENTITY,
}
