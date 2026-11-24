import { useCallback, useState } from "react"
import { choicesOf, type OverrideChoices, sameChoices } from "@/features/login-methods/lib/login-method-choices"
import type { LoginMethodOverrides } from "@/features/login-methods/types/login-methods.types"

export interface OverrideChoicesDraft {
	choices: OverrideChoices
	changed: boolean
	change: (choices: OverrideChoices) => void
	accept: (saved: LoginMethodOverrides) => void
}

// CAP-012-R02
export function useOverrideChoices(stored: LoginMethodOverrides): OverrideChoicesDraft {
	const [baseline, setBaseline] = useState<OverrideChoices>(() => choicesOf(stored))
	const [choices, setChoices] = useState<OverrideChoices>(baseline)

	const accept = useCallback((saved: LoginMethodOverrides) => {
		const next = choicesOf(saved)
		setBaseline(next)
		setChoices(next)
	}, [])

	return { choices, changed: !sameChoices(choices, baseline), change: setChoices, accept }
}
