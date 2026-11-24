import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import { deliveryQueryOf } from "@/features/deliveries/lib/delivery-filter"
import type {
	DeliveriesPage,
	Delivery,
	DeliveryClosure,
	DeliveryFilter,
	DeliveryTarget,
	TextRecognitionRestart,
} from "@/features/deliveries/types/delivery.types"
import { useLiveRefresh } from "@/lib/live-refresh"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"
import { type LiveRequest, useLiveRequest } from "@/lib/use-live-request"

const DELIVERIES_PATH = "/monitoring/deliveries"
const TARGETS_PATH = "/delivery-targets"

function deliveryPath(deliveryId: string): string {
	return `${DELIVERIES_PATH}/${encodeURIComponent(deliveryId)}`
}

function instancePath(deliveryId: string, instanceId: string): string {
	return `${deliveryPath(deliveryId)}/instances/${encodeURIComponent(instanceId)}`
}

// NAB-345, NAB-534, administration.yaml listDeliveries
export function useDeliveries(filter: DeliveryFilter): CursorList<Delivery> {
	const { state, instanceState } = filter
	const loadPage = useCallback(
		(cursor: string | undefined, init?: RequestInit) =>
			callApi<DeliveriesPage>(
				withQuery(DELIVERIES_PATH, { cursor, ...deliveryQueryOf({ state, instanceState }) }),
				init,
			),
		[state, instanceState],
	)
	const list = useCursorList(loadPage)
	useLiveRefresh(list.refresh)
	return list
}

// NAB-345, NAB-534, administration.yaml getDelivery
export function useDelivery(deliveryId: string): LiveRequest<Delivery> {
	const load = useCallback(
		(init: RequestInit | undefined) => callApi<Delivery>(deliveryPath(deliveryId), init),
		[deliveryId],
	)
	return useLiveRequest(load)
}

// NAB-534, CAP-023-R23, CAP-023-R24, administration.yaml listDeliveryTargets
export function useDeliveryTargets(): LiveRequest<DeliveryTarget[]> {
	const load = useCallback((init: RequestInit | undefined) => callApi<DeliveryTarget[]>(TARGETS_PATH, init), [])
	return useLiveRequest(load)
}

// CAP-023-R23, CAP-023-S10, administration.yaml resumeDeliveryTarget
export function resumeDeliveryTarget(targetCode: string): Promise<void> {
	return callApi<void>(`${TARGETS_PATH}/${encodeURIComponent(targetCode)}/resumption`, { method: "POST" })
}

// CAP-023-R26, CAP-023-S18, administration.yaml resumeDeliveryVerification
export function resumeDeliveryVerification(deliveryId: string, instanceId: string): Promise<void> {
	return callApi<void>(`${instancePath(deliveryId, instanceId)}/verification-resumption`, { method: "POST" })
}

// CAP-023-R28, CAP-023-S24, administration.yaml closeDeliveryInstance
export function closeDeliveryInstance(
	deliveryId: string,
	instanceId: string,
	closure: DeliveryClosure,
): Promise<Delivery> {
	return callApi<Delivery>(`${instancePath(deliveryId, instanceId)}/closure`, {
		method: "POST",
		body: JSON.stringify(closure),
	})
}

// CAP-022-R15, CAP-022-S06, administration.yaml restartTextRecognition
export function restartTextRecognition(deliveryId: string, restart: TextRecognitionRestart): Promise<Delivery> {
	return callApi<Delivery>(`${deliveryPath(deliveryId)}/text-recognition-restart`, {
		method: "POST",
		body: JSON.stringify(restart),
	})
}
