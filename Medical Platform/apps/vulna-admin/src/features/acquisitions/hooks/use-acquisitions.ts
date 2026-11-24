import { useCallback } from "react"
import { callApi, withQuery } from "@/api/client"
import { acquisitionQueryOf } from "@/features/acquisitions/lib/acquisition-filter"
import type {
	AcquisitionFilter,
	AdministeredAcquisition,
	AdministeredAcquisitionsPage,
} from "@/features/acquisitions/types/acquisition.types"
import { type CursorList, useCursorList } from "@/lib/use-cursor-list"
import { type RequestState, useRequest } from "@/lib/use-request"

const ACQUISITIONS_PATH = "/acquisitions"

// CAP-004-R10, administration.yaml searchAcquisitions
export function useAcquisitions(filter: AcquisitionFilter): CursorList<AdministeredAcquisition> {
	const { state, fromDate, toDate, patientIdentifier } = filter
	const loadPage = useCallback(
		(cursor: string | undefined) =>
			callApi<AdministeredAcquisitionsPage>(
				withQuery(ACQUISITIONS_PATH, {
					cursor,
					...acquisitionQueryOf({ state, fromDate, toDate, patientIdentifier }),
				}),
			),
		[state, fromDate, toDate, patientIdentifier],
	)
	return useCursorList(loadPage)
}

// CAP-004-R10, CAP-004-S02, administration.yaml getAcquisitionForAdministration
export function useAcquisition(acquisitionId: string): RequestState<AdministeredAcquisition> {
	const load = useCallback(
		() => callApi<AdministeredAcquisition>(`${ACQUISITIONS_PATH}/${encodeURIComponent(acquisitionId)}`),
		[acquisitionId],
	)
	return useRequest(load)
}
