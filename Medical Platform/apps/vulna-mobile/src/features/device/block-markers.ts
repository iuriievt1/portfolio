import {
	type BlockMarkerStore,
	blockMarkerOf,
	DEVICE_STATUS,
	type DeviceStatus,
	type ManagedEnrolment,
} from "@ansora/core-mobile"
import { storedJson } from "../../utils/stored-json"

const BLOCK_MARKER_KEY = "ansora.vulna.blocked-predecessor"

// CAP-006-R19, CAP-008-R06, zarizeni-a-sifrovani.md 1.1
export const blockMarkers: BlockMarkerStore = storedJson(BLOCK_MARKER_KEY, blockMarkerOf)

// CAP-006-R19, CAP-006-S13
export async function blockedPredecessor(): Promise<Pick<ManagedEnrolment, "blockedPredecessorHwId">> {
	const marker = await blockMarkers.read()
	return marker === undefined ? {} : { blockedPredecessorHwId: marker.predecessorHwId }
}

// CAP-006-R19, CAP-006-R16
export function forgetBlockMarkerOnceApproved(status: DeviceStatus): void {
	if (status.kind !== DEVICE_STATUS.APPROVED) {
		return
	}
	blockMarkers
		.clear()
		.catch((failure: unknown) => console.warn("the marker of the blocked predecessor could not be removed", failure))
}
