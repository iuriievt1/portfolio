import { DEVICE_STATES } from "@/features/devices/constants/device-state"
import type { Device } from "@/features/devices/types/device.types"
import { devicesPagePath } from "@/lib/routes"

// DESIGN.md 9.1, administration.yaml listDevices state
export const DEVICE_STATE_PARAM = "state"

export function deviceStateOf(value: string | null): Device["state"] | undefined {
	return DEVICE_STATES.find((known) => known === value)
}

export function devicesPathOf(state: Device["state"]): string {
	return `${devicesPagePath()}?${new URLSearchParams({ [DEVICE_STATE_PARAM]: state })}`
}
