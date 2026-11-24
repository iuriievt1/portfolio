import type { DeviceEvent } from "@ansora/contracts"
import {
	cryptoAndKeys,
	type DeviceReportPorts,
	deviceKeyIdentity,
	recordDeviceEvents as recordWith,
	sendDeviceEvents as sendWith,
} from "@ansora/core-mobile"
import { reportDeviceEvents } from "../../api/device"
import { deviceReports } from "./device-reports"

export const DEVICE_REPORT_PORTS: DeviceReportPorts = {
	reports: deviceReports,
	deviceKey: () => deviceKeyIdentity(cryptoAndKeys()),
	reportEvents: reportDeviceEvents,
}

// CAP-025-R22, CAP-026-R10
export async function recordDeviceEvents(events: readonly DeviceEvent[]): Promise<void> {
	await recordWith(DEVICE_REPORT_PORTS, events)
}

// CAP-025-R22
export async function sendPendingDeviceEvents(): Promise<void> {
	try {
		await sendWith(DEVICE_REPORT_PORTS)
	} catch (failure) {
		console.warn("the device events could not be sent", failure)
	}
}
