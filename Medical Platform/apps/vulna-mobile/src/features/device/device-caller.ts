import { createDeviceTokenCaller } from "@ansora/core-mobile"
import { errorCodeOf } from "../../api/api-error"
import { deviceApi } from "../../api/device"

// CAP-002-R09
export const deviceCaller = createDeviceTokenCaller(deviceApi, errorCodeOf)
