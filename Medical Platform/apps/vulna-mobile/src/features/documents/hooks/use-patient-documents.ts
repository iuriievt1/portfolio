import { useCallback } from "react"
import { documentApi, type PatientDocumentItem } from "../../../api/documents"
import { loadedPageOf } from "../../../api/pages"
import { usePagedWithCodeLists } from "../../code-lists/hooks/use-paged-with-code-lists"
import { sessionCaller } from "../../session/session-actions"

// CAP-020-R18, CAP-020-R12, ADR-012
export function usePatientDocuments(patientId: string) {
	const readPage = useCallback(
		async (cursor: string | undefined) =>
			loadedPageOf(
				await sessionCaller.call((sessionToken) => documentApi.listPatientDocuments(sessionToken, patientId, cursor)),
			),
		[patientId],
	)
	return usePagedWithCodeLists<PatientDocumentItem>(readPage)
}
