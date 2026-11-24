import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"

// DESIGN.md 8.2, DESIGN.md 9.5
export const REVOKE_DIALOG_TEXTS = {
	confirmLabel: cs.common.revoke,
	pendingLabel: cs.common.revoking,
	cancelLabel: cs.common.cancel,
	closeLabel: cs.common.close,
	failureMessageOf: (failure: unknown) => errorMessageOf(failure),
}
