import {
	cryptoAndKeys,
	currentDeviceStatus,
	DEVICE_STATUS,
	type DeviceStatus,
	ERASURE_STATE,
	type ErasureState,
} from "@ansora/core-mobile"
import { deviceApi } from "../../api/device"
import { resumeUploadQueue } from "../upload/upload-queue"
import { forgetBlockMarkerOnceApproved } from "./block-markers"
import { rememberRegistration } from "./device-registration"
import { eraseAfterRevocation, resumeErasure } from "./remote-erasure"

const CHECK_SCREEN_SHORTEST_MS = 800

const REVOKED: DeviceStatus = { kind: DEVICE_STATUS.REVOKED }

export function checkDevice(): Promise<DeviceStatus> {
	return withCheckScreen(deviceStatusAfterErasure())
}

export async function withCheckScreen<T>(work: Promise<T>): Promise<T> {
	const [result] = await Promise.all([work, shownFor(CHECK_SCREEN_SHORTEST_MS)])
	return result
}

// CAP-007-R04, CAP-007-R11, CAP-025-R22
async function deviceStatusAfterErasure(): Promise<DeviceStatus> {
	if ((await resumedErasure()) !== ERASURE_STATE.NONE) {
		return REVOKED
	}
	const status = await currentDeviceStatus(deviceApi, cryptoAndKeys())
	rememberRegistration(status)
	forgetBlockMarkerOnceApproved(status)
	if (status.kind === DEVICE_STATUS.APPROVED) {
		resumeUploadQueue()
	}
	if (status.kind === DEVICE_STATUS.REVOKED) {
		await eraseAfterRevocation().catch((failure: unknown) =>
			console.warn("the local data could not be erased after the revocation", failure),
		)
	}
	return status
}

async function resumedErasure(): Promise<ErasureState> {
	try {
		return await resumeErasure()
	} catch (failure) {
		console.warn("the waiting erasure could not be resumed", failure)
		return ERASURE_STATE.NONE
	}
}

function shownFor(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
