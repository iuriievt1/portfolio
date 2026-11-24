import type { DeviceEvent } from "@ansora/contracts"
import type { DeviceReport, DeviceReportPorts } from "../device-events"

export const DEVICE_KEY = "x.y"
export const OTHER_DEVICE_KEY = "a.b"

export interface FakeDevice {
	ports: DeviceReportPorts
	stored: () => DeviceReport | undefined
	reported: DeviceEvent[][]
	answerWith: (answer: (events: readonly DeviceEvent[]) => string[]) => void
	useDeviceKey: (deviceKey: string) => void
}

export function fakeDevice(initial?: DeviceReport): FakeDevice {
	let report = initial
	let deviceKey = DEVICE_KEY
	const reported: DeviceEvent[][] = []
	let answer: (events: readonly DeviceEvent[]) => string[] = () => {
		throw new TypeError("Network request failed")
	}
	return {
		ports: {
			reports: {
				read: async () => report,
				update: async (change) => {
					report = change(report)
					return report
				},
			},
			deviceKey: async () => deviceKey,
			reportEvents: async (events) => {
				reported.push([...events])
				return { recorded_keys: answer(events) }
			},
		},
		stored: () => report,
		reported,
		answerWith: (next) => {
			answer = next
		},
		useDeviceKey: (next) => {
			deviceKey = next
		},
	}
}

export function recordedAll(events: readonly DeviceEvent[]): string[] {
	return events.map((event) => event.idempotency_key)
}
