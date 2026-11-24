import type { BodyDiagramDrawing } from "@ansora/contracts"
import { useCallback } from "react"
import type { AcquisitionDraft } from "../../../api/acquisitions"
import type { BodyDiagramRegion } from "../../../api/code-lists"
import { refreshDraft } from "../../capture/draft-update"
import { bodyDiagramDrawing, syncCodeLists } from "../../code-lists/code-list-store"
import { useRemoteContent } from "../../remote/hooks/use-remote-content"
import { patientFindings } from "../patient-findings"
import { type LocatedFinding, locatedFindings } from "../wound-map-layout"

export interface LocationData {
	draft: AcquisitionDraft
	regions: readonly BodyDiagramRegion[]
	drawing: BodyDiagramDrawing
	wounds: readonly LocatedFinding[]
}

// CAP-016-R17, CAP-016-R18, CAP-016-R07, CAP-020-R20, CAP-015-R15
export function useLocationData(patientId: string, acquisitionId: string) {
	const read = useCallback(async (): Promise<LocationData> => {
		const [draft, codeLists, findings] = await Promise.all([
			refreshDraft(acquisitionId),
			syncCodeLists(),
			patientFindings(patientId),
		])
		const drawing = await bodyDiagramDrawing(codeLists)
		return { draft, regions: codeLists.body_diagram.regions, drawing, wounds: locatedFindings(findings, drawing) }
	}, [patientId, acquisitionId])
	return useRemoteContent(read)
}
