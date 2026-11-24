import { APPLE_MODEL_NAMES } from "@/features/devices/constants/apple-models"
import type { Device } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"

const APPLE_IDENTIFIER = /^(iPhone|iPad|iPod)\d+,\d+$/
const IPAD_FAMILY = "iPad"
const SYSTEM_SEPARATOR = " "

export function deviceName(device: Device): string {
	const model = device.model
	if (model === undefined || model === "") {
		return cs.devices.unknownModel
	}
	return APPLE_MODEL_NAMES[model] ?? appleFamilyOf(model) ?? model
}

export function deviceSystem(device: Device): string {
	const parts = [platformOf(device.model), device.os_version].filter((part) => part !== undefined && part !== "")
	return parts.length === 0 ? cs.common.notStated : parts.join(SYSTEM_SEPARATOR)
}

function appleFamilyOf(model: string): string | undefined {
	return APPLE_IDENTIFIER.exec(model)?.[1]
}

function platformOf(model: string | undefined): string | undefined {
	if (model === undefined || model === "") {
		return undefined
	}
	const family = appleFamilyOf(model)
	if (family === undefined) {
		return cs.devices.system.android
	}
	return family === IPAD_FAMILY ? cs.devices.system.ipados : cs.devices.system.ios
}
