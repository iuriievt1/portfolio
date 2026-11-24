import { ERROR_CODE, LOGIN_RETURN_URL } from "@ansora/contracts"
import {
	ACCOUNT_LOGIN_OUTCOME,
	type AccountLoginOutcome,
	type AccountLoginRequest,
	cryptoAndKeys,
	newPinViolation,
	type PinPolicyViolation,
	type PinSetup,
	type Session,
	signInWithAccount,
} from "@ansora/core-mobile"
import { useCallback, useRef, useState } from "react"
import { errorCodeOf } from "../../../api/api-error"
import { discoveryReader } from "../../../api/discovery"
import { loginApi } from "../../../api/login"
import { oidcDiscoveryUrl } from "../../../api/server-address"
import { currentPinPolicy, rememberEffectiveConfiguration } from "../../session/effective-configuration-store"
import { rememberSession } from "../../session/session-store"
import { platformLoginWindow } from "../login-window"

export const LOGIN_PHASE = {
	IDLE: "idle",
	BUSY: "busy",
	PIN_SETUP: "pin_setup",
	FAILED: "failed",
	SIGNED_IN: "signed_in",
} as const

export type LoginFailure = Exclude<
	AccountLoginOutcome,
	{ kind: typeof ACCOUNT_LOGIN_OUTCOME.SESSION } | { kind: typeof ACCOUNT_LOGIN_OUTCOME.PIN_SETUP_REQUIRED }
>

export type LoginPhase =
	| { kind: typeof LOGIN_PHASE.IDLE }
	| { kind: typeof LOGIN_PHASE.BUSY }
	| {
			kind: typeof LOGIN_PHASE.PIN_SETUP
			replacesPin: boolean
			violation: PinPolicyViolation | undefined
			verifying: boolean
	  }
	| { kind: typeof LOGIN_PHASE.FAILED; failure: LoginFailure }
	| { kind: typeof LOGIN_PHASE.SIGNED_IN; session: Session }

export interface AccountLogin {
	phase: LoginPhase
	signIn: (request: AccountLoginRequest) => Promise<void>
	submitPin: (pin: string) => Promise<void>
	reset: () => void
}

type PendingPinSetup = {
	complete: (pinProofSetup: string) => Promise<AccountLoginOutcome>
	replacesPin: boolean
}

function pinSetup(replacesPin: boolean, violation?: PinPolicyViolation, verifying = false): LoginPhase {
	return { kind: LOGIN_PHASE.PIN_SETUP, replacesPin, violation, verifying }
}

async function bindLocalAccount(session: Session, setup: PinSetup | undefined): Promise<void> {
	const personalNumber = session.user.personal_number
	if (personalNumber === undefined) {
		throw new Error("the session names no personal number")
	}
	const keys = cryptoAndKeys()
	if (setup === undefined) {
		if ((await keys.pinAccount(personalNumber)) === null) {
			return
		}
		await keys.renamePinAccount(personalNumber, session.user.display_name)
	} else {
		await keys.commitPin(setup.setupId, personalNumber, session.user.display_name)
	}
	await keys.setCurrentPinAccount(personalNumber, session.session_end)
}

export function useAccountLogin(): AccountLogin {
	const [phase, setPhase] = useState<LoginPhase>({ kind: LOGIN_PHASE.IDLE })
	const pending = useRef<PendingPinSetup | undefined>(undefined)

	const settle = useCallback(
		async (outcome: AccountLoginOutcome, setup: PinSetup | undefined, replacesPin: boolean) => {
			switch (outcome.kind) {
				case ACCOUNT_LOGIN_OUTCOME.SESSION:
					await bindLocalAccount(outcome.session, setup)
					rememberEffectiveConfiguration(outcome.session.effective_configuration)
					rememberSession(outcome.session)
					pending.current = undefined
					setPhase({ kind: LOGIN_PHASE.SIGNED_IN, session: outcome.session })
					return
				case ACCOUNT_LOGIN_OUTCOME.PIN_SETUP_REQUIRED:
					pending.current = { complete: outcome.complete, replacesPin }
					setPhase(pinSetup(replacesPin))
					return
				default:
					pending.current = undefined
					setPhase({ kind: LOGIN_PHASE.FAILED, failure: outcome })
			}
		},
		[],
	)

	const guarded = useCallback(async (step: () => Promise<void>) => {
		try {
			await step()
		} catch (failure) {
			console.warn("account sign-in failed", failure)
			pending.current = undefined
			setPhase({
				kind: LOGIN_PHASE.FAILED,
				failure: { kind: ACCOUNT_LOGIN_OUTCOME.REJECTED, code: ERROR_CODE.LOGIN_FAILED },
			})
		}
	}, [])

	const signIn = useCallback(
		(request: AccountLoginRequest) =>
			guarded(async () => {
				setPhase({ kind: LOGIN_PHASE.BUSY })
				const outcome = await signInWithAccount(
					{
						api: loginApi,
						window: platformLoginWindow,
						discovery: discoveryReader,
						discoveryUrl: oidcDiscoveryUrl(),
						returnUrl: LOGIN_RETURN_URL,
						problemCodeOf: errorCodeOf,
					},
					request,
				)
				await settle(outcome, undefined, request.expectedPersonalNumber !== undefined)
			}),
		[guarded, settle],
	)

	const submitPin = useCallback(
		(pin: string) =>
			guarded(async () => {
				const setup = pending.current
				if (setup === undefined) {
					return
				}
				const violation = newPinViolation(pin, currentPinPolicy())
				if (violation !== undefined) {
					setPhase(pinSetup(setup.replacesPin, violation))
					return
				}
				setPhase(pinSetup(setup.replacesPin, undefined, true))
				const prepared = await cryptoAndKeys().preparePin(pin)
				const outcome = await setup.complete(prepared.pinProofSetup)
				if (outcome.kind !== ACCOUNT_LOGIN_OUTCOME.SESSION) {
					await cryptoAndKeys().discardPin(prepared.setupId)
				}
				await settle(outcome, prepared, setup.replacesPin)
			}),
		[guarded, settle],
	)

	const reset = useCallback(() => {
		pending.current = undefined
		setPhase({ kind: LOGIN_PHASE.IDLE })
	}, [])

	return { phase, signIn, submitPin, reset }
}
