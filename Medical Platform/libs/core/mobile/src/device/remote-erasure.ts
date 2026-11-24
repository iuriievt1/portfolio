import { LOCAL_DATA_DELETION_REASON, type LocalDataDeletionReason } from "@ansora/contracts"
import {
	currentReport,
	type DeletedItems,
	type DeviceReportPorts,
	localDataDeletionEvent,
	sendDeviceEvents,
} from "./device-events"

const MILLISECONDS_PER_SECOND = 1000

export interface ErasurePorts extends DeviceReportPorts {
	unsentItems(): Promise<DeletedItems>
	eraseLocalData(): Promise<void>
	forgetDeviceKey(): Promise<void>
	newEventKey(): Promise<string>
	now(): Date
}

export type DeletionRecordPorts = Omit<ErasurePorts, "eraseLocalData" | "forgetDeviceKey" | "reportEvents">

export interface DeletionContext {
	userId: string | null
	deviceKeyHoldSeconds: number
	reason: LocalDataDeletionReason
}

export type ErasureContext = Omit<DeletionContext, "reason">

export const ERASURE_STATE = {
	NONE: "none",
	REPORTING: "reporting",
	RELEASED: "released",
} as const

export type ErasureState = (typeof ERASURE_STATE)[keyof typeof ERASURE_STATE]

// CAP-007-R04, CAP-007-R11, CAP-025-R22, zarizeni-a-sifrovani.md 2.1
export async function eraseAfterRevocation(ports: ErasurePorts, context: ErasureContext): Promise<ErasureState> {
	await recordLocalDataDeletion(ports, { ...context, reason: LOCAL_DATA_DELETION_REASON.DEVICE_REVOCATION })
	await ports.eraseLocalData()
	return await reportErasure(ports)
}

// CAP-007-R08, CAP-008-R06, CAP-008-R09, CAP-025-R22
export async function recordLocalDataDeletion(ports: DeletionRecordPorts, context: DeletionContext): Promise<void> {
	if ((await erasureReleaseAt(ports)) !== undefined) {
		return
	}
	const unsent = await ports.unsentItems()
	const now = ports.now()
	const deviceKey = await ports.deviceKey()
	const deletion = localDataDeletionEvent(await ports.newEventKey(), now, context.userId, context.reason, unsent)
	const releaseAt = secondsAfter(now, context.deviceKeyHoldSeconds).toISOString()
	await ports.reports.update((stored) => ({
		deviceKey,
		events: [deletion, ...(stored?.deviceKey === deviceKey ? stored.events : [])],
		releaseAt,
	}))
}

// CAP-007-R04, CAP-025-R22
export async function resumeErasure(ports: ErasurePorts): Promise<ErasureState> {
	if ((await erasureReleaseAt(ports)) === undefined) {
		return ERASURE_STATE.NONE
	}
	await ports.eraseLocalData()
	return await reportErasure(ports)
}

// CAP-025-R22, CAP-025-S14, CAP-025-S15, CAP-025-S16
export async function reportErasure(ports: ErasurePorts): Promise<ErasureState> {
	const releaseAt = await erasureReleaseAt(ports)
	if (releaseAt === undefined) {
		return ERASURE_STATE.NONE
	}
	if (isHoldOver(ports.now(), releaseAt)) {
		return await release(ports)
	}
	if ((await sendDeviceEvents(ports)) === 0) {
		return await release(ports)
	}
	return ERASURE_STATE.REPORTING
}

// CAP-025-R22, CAP-025-S16
export function isHoldOver(now: Date, releaseAt: string): boolean {
	return now.getTime() >= Date.parse(releaseAt)
}

// CAP-025-R22
export async function erasureReleaseAt(
	ports: Pick<ErasurePorts, "reports" | "deviceKey">,
): Promise<string | undefined> {
	return (await currentReport(ports))?.releaseAt ?? undefined
}

async function release(ports: ErasurePorts): Promise<ErasureState> {
	await ports.forgetDeviceKey()
	await ports.reports.update(() => undefined)
	return ERASURE_STATE.RELEASED
}

function secondsAfter(date: Date, seconds: number): Date {
	return new Date(date.getTime() + seconds * MILLISECONDS_PER_SECOND)
}
