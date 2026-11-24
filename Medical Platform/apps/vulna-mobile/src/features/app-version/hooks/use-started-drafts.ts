import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useOwnDrafts } from "../../drafts/hooks/use-own-drafts"
import { LOAD_STATE } from "../../remote/hooks/use-remote-content"

const NO_DRAFTS: readonly AcquisitionDraftSummary[] = []

// CAP-012-R25, CHG-180
export function useStartedDrafts(): readonly AcquisitionDraftSummary[] {
	const { state } = useOwnDrafts()
	return state.kind === LOAD_STATE.READY ? state.drafts : NO_DRAFTS
}
