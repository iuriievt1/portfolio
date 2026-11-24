import type { MobileContract } from "@ansora/contracts"
import { callApi } from "./client"

type Schemas = MobileContract.components["schemas"]

export type AcquisitionDetail = Schemas["AcquisitionDetail"]
export type AcquisitionDetailFile = Schemas["AcquisitionDetailFile"]
export type DocumentTitle = Schemas["DocumentTitle"]

const ACQUISITIONS_PATH: keyof MobileContract.paths = "/acquisitions"

function detailPath(acquisitionId: string): string {
	return `${ACQUISITIONS_PATH}/${encodeURIComponent(acquisitionId)}/detail`
}

export const recordApi = {
	// CAP-020-R17, CAP-025-R28
	getAcquisition: (sessionToken: string, acquisitionId: string): Promise<AcquisitionDetail> =>
		callApi<AcquisitionDetail>(detailPath(acquisitionId), { sessionToken }),
}
