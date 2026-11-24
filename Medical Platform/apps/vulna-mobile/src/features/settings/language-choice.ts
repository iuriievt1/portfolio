import { ERROR_CODE } from "@ansora/contracts"

export const LANGUAGE_CHOICE = {
	IDLE: "idle",
	SAVING: "saving",
	OFFLINE: "offline",
	UNSUPPORTED: "unsupported",
} as const

export type LanguageChoice =
	| { kind: typeof LANGUAGE_CHOICE.IDLE }
	| { kind: typeof LANGUAGE_CHOICE.SAVING; language: string }
	| { kind: typeof LANGUAGE_CHOICE.OFFLINE; language: string }
	| { kind: typeof LANGUAGE_CHOICE.UNSUPPORTED }

// E84
export function choiceAfterFailure(code: string | undefined, language: string): LanguageChoice {
	if (code === ERROR_CODE.LANGUAGE_UNSUPPORTED) {
		return { kind: LANGUAGE_CHOICE.UNSUPPORTED }
	}
	return { kind: LANGUAGE_CHOICE.OFFLINE, language }
}

// CAP-015-S35
export function acceptsChoice(choice: LanguageChoice): boolean {
	return choice.kind === LANGUAGE_CHOICE.IDLE || choice.kind === LANGUAGE_CHOICE.UNSUPPORTED
}
