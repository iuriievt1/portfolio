import { type Finding, findingApi } from "../../api/findings"
import { readAllPages } from "../../api/pages"
import { sessionCaller } from "../session/session-actions"

// CAP-016-R17, CAP-020-R20
export function patientFindings(patientId: string): Promise<readonly Finding[]> {
	return readAllPages((cursor) =>
		sessionCaller.call((sessionToken) => findingApi.listPatientFindings(sessionToken, patientId, cursor)),
	)
}
