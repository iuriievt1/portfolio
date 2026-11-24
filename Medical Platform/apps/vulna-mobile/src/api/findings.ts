import type { MobileContract } from "@ansora/contracts"
import { ACCEPTS_OUTDATED_APP, callApi } from "./client"
import { withQuery } from "./query"

type Schemas = MobileContract.components["schemas"]

export type Finding = Schemas["Finding"]
export type BodySite = Schemas["BodySite"]
export type TimelineItem = Schemas["TimelineItem"]
export type TimelinePage = Schemas["TimelinePage"]
export type WoundTypeChange = Schemas["WoundTypeChange"]
export type FindingWoundTypeChange = Schemas["FindingWoundTypeChange"]
type FindingsPage = Schemas["FindingsPage"]

const FINDINGS_PATH: keyof MobileContract.paths = "/findings"

function findingPath(findingId: string): string {
	return `${FINDINGS_PATH}/${encodeURIComponent(findingId)}`
}

export const findingApi = {
	// CAP-016-R17, CAP-020-R20, CAP-012-R25
	listPatientFindings: (sessionToken: string, patientId: string, cursor: string | undefined): Promise<FindingsPage> =>
		callApi<FindingsPage>(withQuery(FINDINGS_PATH, { patient_id: patientId, cursor }), {
			sessionToken,
			...ACCEPTS_OUTDATED_APP,
		}),
	// CAP-020-R02, CAP-016-R17
	getFindingHistory: (sessionToken: string, findingId: string, cursor: string | undefined): Promise<TimelinePage> =>
		callApi<TimelinePage>(withQuery(`${findingPath(findingId)}/history`, { cursor }), { sessionToken }),
	// CAP-020-R21, CAP-025-R30
	changeFindingWoundType: (sessionToken: string, findingId: string, change: FindingWoundTypeChange): Promise<Finding> =>
		callApi<Finding>(`${findingPath(findingId)}/wound-type`, { method: "PUT", body: change, sessionToken }),
}
