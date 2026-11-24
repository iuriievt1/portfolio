import type { DiscardSituation } from "@ansora/contracts"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useDraftDiscard } from "../hooks/use-draft-discard"
import { useOwnDrafts } from "../hooks/use-own-drafts"
import { DraftDiscardDialogs } from "./DraftDiscardDialogs"
import { OwnDraftsSheet } from "./OwnDraftsSheet"

interface Props {
	situation: DiscardSituation
	onContinue: (draft: AcquisitionDraftSummary) => void
	onClose: () => void
}

// CAP-015-R17, CAP-015-R18, CAP-015-S14
export function OwnDraftsFlow({ situation, onContinue, onClose }: Props) {
	const { state, retry, reload } = useOwnDrafts()
	const { discard, choose, confirm, dismiss } = useDraftDiscard(situation, reload)
	return (
		<>
			<OwnDraftsSheet
				state={state}
				onRetry={retry}
				onClose={onClose}
				onContinue={onContinue}
				onDiscard={(draft) => void choose(draft)}
			/>
			<DraftDiscardDialogs discard={discard} onConfirm={(draft) => void confirm(draft)} onDismiss={dismiss} />
		</>
	)
}
