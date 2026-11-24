import { NoSessionError } from "@ansora/core-mobile"
import { useCallback, useState } from "react"
import { errorCodeOf } from "../../../api/api-error"
import { languageApi } from "../../../api/language"
import { checkDevice } from "../../device/device-check"
import { sessionCaller } from "../../session/session-actions"
import { rememberLanguageChoice } from "../../session/session-store"
import { choiceAfterFailure, LANGUAGE_CHOICE, type LanguageChoice } from "../language-choice"

// CAP-015-R25
export function useLanguageChoice() {
	const [choice, setChoice] = useState<LanguageChoice>({ kind: LANGUAGE_CHOICE.IDLE })

	const choose = useCallback(async (language: string) => {
		setChoice({ kind: LANGUAGE_CHOICE.SAVING, language })
		try {
			const stored = await sessionCaller.call((sessionToken) =>
				languageApi.setLanguagePreference(sessionToken, language),
			)
			rememberLanguageChoice(stored.language ?? language)
			setChoice({ kind: LANGUAGE_CHOICE.IDLE })
		} catch (error) {
			if (error instanceof NoSessionError) {
				setChoice({ kind: LANGUAGE_CHOICE.IDLE })
				return
			}
			const next = choiceAfterFailure(errorCodeOf(error), language)
			if (next.kind === LANGUAGE_CHOICE.UNSUPPORTED) {
				void checkDevice().catch((failure: unknown) =>
					console.warn("the language list could not be refreshed", failure),
				)
			}
			setChoice(next)
		}
	}, [])

	return { choice, choose }
}
