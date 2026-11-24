import { storedSeconds } from "../../utils/stored-seconds"

// konfigurace-a-profily.md 2.7
const DEFAULT_DEVICE_KEY_HOLD_SECONDS = 604_800

// CAP-025-R22, konfigurace-a-profily.md 2.7
const deviceKeyHold = storedSeconds("ansora.vulna.device-key-hold-seconds")

export const rememberDeviceKeyHold = deviceKeyHold.remember

export async function deviceKeyHoldSeconds(): Promise<number> {
	return (await deviceKeyHold.read()) ?? DEFAULT_DEVICE_KEY_HOLD_SECONDS
}
