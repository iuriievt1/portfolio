import type { Blocker } from "react-router"
import { UnsavedChangesDialog } from "@/components/custom/unsaved-changes-dialog"
import cs from "@/i18n/cs.json"

// DESIGN.md 9.4
export function UnsavedChangesPrompt({ blocker }: { blocker: Blocker }) {
	return (
		<UnsavedChangesDialog
			blocker={blocker}
			heading={cs.common.unsaved.heading}
			body={cs.common.unsaved.body}
			stayLabel={cs.common.unsaved.stay}
			leaveLabel={cs.common.unsaved.leave}
			closeLabel={cs.common.close}
		/>
	)
}
