import { type AcquisitionDraftSummary, acquisitionApi } from "../../api/acquisitions"
import { readAllPages } from "../../api/pages"

// CAP-015-R29, CAP-012-R25
export async function readOwnDrafts(sessionToken: string): Promise<AcquisitionDraftSummary[]> {
	return await readAllPages((cursor) => acquisitionApi.listAcquisitionDrafts(sessionToken, cursor))
}
