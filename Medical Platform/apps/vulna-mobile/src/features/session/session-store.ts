import type { Session } from "@ansora/core-mobile"
import { setSignedInLanguage } from "../../i18n/language-store"
import { sharedValue, useSharedValue } from "../../utils/shared-value"
import { rememberOwnerLanguage } from "./owner-language"
import { markSessionTokenIssued } from "./session-token-events"

export const SESSION_CLOSURE = {
	ENDED: "ended",
	SIGNED_OUT: "signed_out",
} as const

export type SessionClosure = (typeof SESSION_CLOSURE)[keyof typeof SESSION_CLOSURE]

let current: Session | undefined
let endOfLastSession: string | undefined
const closure = sharedValue<SessionClosure | undefined>(undefined)

export function rememberSession(session: Session): void {
	current = session
	endOfLastSession = undefined
	closure.set(undefined)
	applyLanguage(session, session.user.preferred_language ?? null)
	markSessionTokenIssued()
}

// CAP-015-R25
export function rememberLanguageChoice(language: string): void {
	if (current === undefined) {
		return
	}
	current = { ...current, user: { ...current.user, preferred_language: language } }
	applyLanguage(current, language)
}

// CAP-002-R21
export function renewSession(session: Session): void {
	if (current?.session_id === session.session_id) {
		current = session
		markSessionTokenIssued()
	}
}

export function currentSession(): Session | undefined {
	return current
}

export function lockSession(): void {
	endOfLastSession = current?.session_end
	current = undefined
}

export function closeSession(kind: SessionClosure, at: Date): void {
	endOfLastSession = at.toISOString()
	current = undefined
	closure.set(kind)
}

// CAP-007-R04
export function forgetSession(): void {
	current = undefined
	endOfLastSession = undefined
	closure.set(undefined)
}

export function lastSessionEnd(): string | undefined {
	return endOfLastSession
}

export function sessionClosure(): SessionClosure | undefined {
	return closure.get()
}

export function useSessionClosure(): SessionClosure | undefined {
	return useSharedValue(closure)
}

function applyLanguage(session: Session, language: string | null): void {
	setSignedInLanguage(language)
	const personalNumber = session.user.personal_number
	if (personalNumber !== undefined) {
		void rememberOwnerLanguage({ personalNumber, language }).catch((failure: unknown) =>
			console.warn("the owner's language could not be stored", failure),
		)
	}
}
