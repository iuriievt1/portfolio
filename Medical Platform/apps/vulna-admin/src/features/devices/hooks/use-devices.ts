import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import type {
	Device,
	DeviceApproval,
	DeviceSaveResult,
	DevicesPage,
	DeviceUnblocking,
	GroupAssignment,
} from "@/features/devices/types/device.types"
import type { LoginMethodOverrides } from "@/features/login-methods/types/login-methods.types"
import { useLiveRefresh } from "@/lib/live-refresh"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"
import { type RequestState, useRequest } from "@/lib/use-request"

const DEVICES_PATH = "/devices"

function devicePath(deviceId: string): string {
	return `${DEVICES_PATH}/${encodeURIComponent(deviceId)}`
}

// administration.yaml listDevices state, CAP-028-R14
export function useDevices(state: Device["state"] | undefined): CursorList<Device> {
	const loadPage = useCallback(
		(cursor: string | undefined, init?: RequestInit) =>
			callApi<DevicesPage>(withQuery(DEVICES_PATH, { cursor, state }), init),
		[state],
	)
	const list = useCursorList(loadPage)
	useLiveRefresh(list.refresh)
	return list
}

export function useDevice(deviceId: string): RequestState<Device> {
	const load = useCallback(() => callApi<Device>(devicePath(deviceId)), [deviceId])
	return useRequest(load)
}

export function approveDevice(deviceId: string, approval: DeviceApproval): Promise<Device> {
	return callApi<Device>(`${devicePath(deviceId)}/approval`, { method: "POST", body: JSON.stringify(approval) })
}

// CAP-007-R02, CAP-007-R06
export function revokeDevice(deviceId: string): Promise<Device> {
	return callApi<Device>(`${devicePath(deviceId)}/revocation`, { method: "POST" })
}

// CAP-007-R06, CAP-007-S07, CAP-008-R07
export function unblockDevice(deviceId: string, unblocking: DeviceUnblocking): Promise<Device> {
	return callApi<Device>(`${devicePath(deviceId)}/unblocking`, { method: "POST", body: JSON.stringify(unblocking) })
}

export function assignDeviceToGroup(deviceId: string, assignment: GroupAssignment): Promise<Device> {
	return callApi<Device>(`${devicePath(deviceId)}/group`, { method: "PUT", body: JSON.stringify(assignment) })
}

export function setDeviceLoginMethods(deviceId: string, overrides: LoginMethodOverrides): Promise<DeviceSaveResult> {
	return callApi<DeviceSaveResult>(`${devicePath(deviceId)}/login-methods`, {
		method: "PUT",
		body: JSON.stringify(overrides),
	})
}
