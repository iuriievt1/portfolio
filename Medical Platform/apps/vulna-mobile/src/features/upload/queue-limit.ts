import { effectiveConfiguration } from "../session/effective-configuration-store"
import { transferBuffer } from "./transfer-store"
import { isQueueFull } from "./waiting-files"

// CAP-019-R17, E24
export async function isDeviceQueueFull(): Promise<boolean> {
	const files = await (await transferBuffer()).queued()
	return isQueueFull(files, effectiveConfiguration()?.queue_max_items)
}
