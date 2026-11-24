import {
	DEVICE_EVENT_BATCH_MAX_EVENTS,
	DEVICE_EVENT_TYPE,
	type DeviceEvent,
	type DeviceEventBatchReceipt,
	type LocalDataDeletionEvent,
	type LocalDataDeletionReason,
} from "@ansora/contracts"
import type { CryptoAndKeys } from "../native"
import { isIsoMoment } from "./moment"

// CAP-025-R22, zarizeni-a-sifrovani.md 2.1
export interface DeviceReport {
	deviceKey: string
	events: DeviceEvent[]
	releaseAt: string | null
}

export type DeviceReportChange = (stored: DeviceReport | undefined) => DeviceReport | undefined

export interface DeviceReportStore {
	read(): Promise<DeviceReport | undefined>
	update(change: DeviceReportChange): Promise<DeviceReport | undefined>
}

export interface DeviceReportPorts {
	reports: DeviceReportStore
	deviceKey(): Promise<string>
	reportEvents(events: readonly DeviceEvent[]): Promise<DeviceEventBatchReceipt>
}

export interface DeletedItems {
	count: number
	oldestAcquiredAt: string | null
}

export async function deviceKeyIdentity(keys: Pick<CryptoAndKeys, "deviceKey">): Promise<string> {
	const { publicKeyJwk } = await keys.deviceKey()
	return `${publicKeyJwk.x}.${publicKeyJwk.y}`
}

// CAP-006-S06
export async function currentReport(
	ports: Pick<DeviceReportPorts, "reports" | "deviceKey">,
): Promise<DeviceReport | undefined> {
	const report = await ports.reports.read()
	if (report === undefined) {
		return undefined
	}
	const deviceKey = await ports.deviceKey()
	if (report.deviceKey === deviceKey) {
		return report
	}
	await ports.reports.update((stored) => (stored?.deviceKey === deviceKey ? stored : undefined))
	return undefined
}

// CAP-025-R22
export async function recordDeviceEvents(
	ports: Pick<DeviceReportPorts, "reports" | "deviceKey">,
	events: readonly DeviceEvent[],
): Promise<void> {
	if (events.length === 0) {
		return
	}
	const deviceKey = await ports.deviceKey()
	await ports.reports.update((stored) =>
		stored?.deviceKey === deviceKey
			? { ...stored, events: [...stored.events, ...events] }
			: { deviceKey, events: [...events], releaseAt: null },
	)
}

// CAP-025-R22, CAP-025-S15
export async function sendDeviceEvents(ports: DeviceReportPorts): Promise<number> {
	let waiting = (await currentReport(ports))?.events ?? []
	while (waiting.length > 0) {
		const recorded = await recordedKeysOf(ports, waiting.slice(0, DEVICE_EVENT_BATCH_MAX_EVENTS))
		const left = (await ports.reports.update((stored) => withoutRecorded(stored, recorded)))?.events ?? []
		if (left.length >= waiting.length) {
			return left.length
		}
		waiting = left
	}
	return 0
}

async function recordedKeysOf(ports: DeviceReportPorts, batch: readonly DeviceEvent[]): Promise<Set<string>> {
	try {
		return new Set((await ports.reportEvents(batch)).recorded_keys)
	} catch (failure) {
		console.warn("the device events could not be reported yet", failure)
		return new Set()
	}
}

function withoutRecorded(stored: DeviceReport | undefined, recorded: ReadonlySet<string>): DeviceReport | undefined {
	if (stored === undefined) {
		return undefined
	}
	const events = stored.events.filter((event) => !recorded.has(event.idempotency_key))
	if (events.length === 0 && stored.releaseAt === null) {
		return undefined
	}
	return { ...stored, events }
}

// identity.yaml LocalDataDeletionDetails
export function localDataDeletionEvent(
	idempotencyKey: string,
	originatedAt: Date,
	userId: string | null,
	reason: LocalDataDeletionReason,
	deleted: DeletedItems,
): LocalDataDeletionEvent {
	return {
		idempotency_key: idempotencyKey,
		type: DEVICE_EVENT_TYPE.LOCAL_DATA_DELETION,
		originated_at: originatedAt.toISOString(),
		user_id: userId,
		details: { reason, count: deleted.count, oldest_acquired_at: deleted.oldestAcquiredAt },
	}
}

// CAP-025-R22
export function deviceReportOf(stored: string | null): DeviceReport | undefined {
	if (stored === null) {
		return undefined
	}
	try {
		const parsed: unknown = JSON.parse(stored)
		return isDeviceReport(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function isDeviceReport(value: unknown): value is DeviceReport {
	if (typeof value !== "object" || value === null) {
		return false
	}
	const report = value as Partial<DeviceReport>
	const releaseAt = report.releaseAt
	return (
		typeof report.deviceKey === "string" &&
		Array.isArray(report.events) &&
		(releaseAt === null || isIsoMoment(releaseAt))
	)
}
