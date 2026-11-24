import { useCallback } from "react"
import { callApi } from "@/api/client"
import type {
	DeviceGroup,
	DeviceGroupSaveResult,
	DeviceGroupWrite,
	GroupLoginMethodsApplication,
} from "@/features/device-groups/types/device-group.types"
import { type RequestState, useRequest } from "@/lib/use-request"

const DEVICE_GROUPS_PATH = "/device-groups"

function deviceGroupPath(groupId: string): string {
	return `${DEVICE_GROUPS_PATH}/${encodeURIComponent(groupId)}`
}

export function useDeviceGroups(): RequestState<DeviceGroup[]> {
	const load = useCallback(() => callApi<DeviceGroup[]>(DEVICE_GROUPS_PATH), [])
	return useRequest(load)
}

export function useDeviceGroup(groupId: string): RequestState<DeviceGroup> {
	const load = useCallback(() => callApi<DeviceGroup>(deviceGroupPath(groupId)), [groupId])
	return useRequest(load)
}

export function createDeviceGroup(group: DeviceGroupWrite): Promise<DeviceGroupSaveResult> {
	return callApi<DeviceGroupSaveResult>(DEVICE_GROUPS_PATH, { method: "POST", body: JSON.stringify(group) })
}

export function updateDeviceGroup(groupId: string, group: DeviceGroupWrite): Promise<DeviceGroupSaveResult> {
	return callApi<DeviceGroupSaveResult>(deviceGroupPath(groupId), { method: "PATCH", body: JSON.stringify(group) })
}

export function applyGroupLoginMethods(
	groupId: string,
	application: GroupLoginMethodsApplication,
): Promise<DeviceGroupSaveResult> {
	return callApi<DeviceGroupSaveResult>(`${deviceGroupPath(groupId)}/login-methods`, {
		method: "POST",
		body: JSON.stringify(application),
	})
}
