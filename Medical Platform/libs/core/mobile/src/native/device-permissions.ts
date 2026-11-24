import { requireNativeModule } from "expo"
import type { DevicePermissions } from "./index"

const MODULE_NAME = "DevicePermissions"

export function devicePermissions(): DevicePermissions {
	return requireNativeModule<DevicePermissions>(MODULE_NAME)
}
