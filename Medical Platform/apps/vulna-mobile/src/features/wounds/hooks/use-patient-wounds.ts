import { useCallback } from "react"
import { type Finding, findingApi } from "../../../api/findings"
import { loadedPageOf } from "../../../api/pages"
import { usePagedWithCodeLists } from "../../code-lists/hooks/use-paged-with-code-lists"
import { sessionCaller } from "../../session/session-actions"
import { useReloadAfterFindingChange } from "./use-reload-after-finding-change"

// CAP-020-R01, CAP-020-R20, CAP-020-R12, ADR-012
export function usePatientWounds(patientId: string) {
	const readPage = useCallback(
		async (cursor: string | undefined) =>
			loadedPageOf(
				await sessionCaller.call((sessionToken) => findingApi.listPatientFindings(sessionToken, patientId, cursor)),
			),
		[patientId],
	)
	const wounds = usePagedWithCodeLists<Finding>(readPage)
	useReloadAfterFindingChange(wounds.reload)
	return wounds
}
