import { useEffect } from "react"
import { captureSessionOf } from "../../capture/capture-session"
import { refreshDraft } from "../../capture/draft-update"

// CAP-015-R15, CAP-021-R32
export function useKnownDraft(acquisitionId: string): void {
	useEffect(() => {
		if (captureSessionOf(acquisitionId).draft !== undefined) {
			return
		}
		refreshDraft(acquisitionId).catch((failure: unknown) => console.warn("the draft could not be read", failure))
	}, [acquisitionId])
}
