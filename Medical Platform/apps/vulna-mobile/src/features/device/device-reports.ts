import { type DeviceReport, type DeviceReportChange, type DeviceReportStore, deviceReportOf } from "@ansora/core-mobile"
import * as SecureStore from "expo-secure-store"

const DEVICE_REPORT_KEY = "ansora.vulna.device-report"

let lastWork: Promise<unknown> = Promise.resolve()

function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
	const run = lastWork.then(work, work)
	lastWork = run.catch(() => undefined)
	return run
}

async function stored(): Promise<DeviceReport | undefined> {
	return deviceReportOf(await SecureStore.getItemAsync(DEVICE_REPORT_KEY))
}

async function changed(change: DeviceReportChange): Promise<DeviceReport | undefined> {
	const next = change(await stored())
	if (next === undefined) {
		await SecureStore.deleteItemAsync(DEVICE_REPORT_KEY)
	} else {
		await SecureStore.setItemAsync(DEVICE_REPORT_KEY, JSON.stringify(next))
	}
	return next
}

// CAP-025-R22, zarizeni-a-sifrovani.md 2.1
export const deviceReports: DeviceReportStore = {
	read: () => oneAtATime(stored),
	update: (change) => oneAtATime(() => changed(change)),
}
