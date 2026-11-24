import { ERROR_CODE, LOGIN_METHOD, type LoginMethod } from "@ansora/contracts"
import {
	CARD_READING,
	type CardReading,
	ChallengeReserve,
	cardIdentifierOf,
	cryptoAndKeys,
	isDeviceErrorCode,
	isPinEntryComplete,
	nfcReader,
	QUICK_LOGIN_OUTCOME,
	type QuickLoginOutcome,
	type Session,
	signInWithBarcode,
	signInWithCard,
	signInWithPin,
	signInWithQrCode,
} from "@ansora/core-mobile"
import { useCallback, useEffect, useRef, useState } from "react"
import { ApiProblemError, errorCodeOf, isNoConnection } from "../../../api/api-error"
import { barcodeLoginApi, cardLoginApi, pinLoginApi, qrCodeLoginApi } from "../../../api/login"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ROUTE } from "../../../navigation/routes"
import { TEXT_TONE } from "../../../ui/typography"
import { millisecondsOf } from "../../../utils/time"
import { CODE_SCAN, type CodeScan, useCodeScan } from "../../code-scan/hooks/use-code-scan"
import { rememberEffectiveConfiguration, withdrawLoginMethod } from "../../session/effective-configuration-store"
import { useOwnerLanguage } from "../../session/hooks/use-owner-language"
import { lastSessionEnd, rememberSession, SESSION_CLOSURE, sessionClosure } from "../../session/session-store"
import type { PinMessage } from "../components/PinEntryFrame"
import { selectUnlockAccount, type UnlockAccount, useSelectedUnlockAccount } from "../selected-account-store"
import { useCurrentAccount } from "./use-current-account"
import { usePinEntry } from "./use-pin-entry"

export const UNLOCK_PHASE = {
	LOADING: "loading",
	NO_ACCOUNT: "no_account",
	ENTRY: "entry",
	READING_CARD: "reading_card",
	READING_CODE: "reading_code",
	VERIFYING: "verifying",
	FAILED: "failed",
	SIGNED_IN: "signed_in",
} as const

export const UNLOCK_FAILURE = {
	OFFLINE: "offline",
	BLOCKED: "blocked",
	SESSION_ENDED: "session_ended",
	FULL_LOGIN_REQUIRED: "full_login_required",
	PROVIDER_UNAVAILABLE: "provider_unavailable",
	ACCOUNT_INACTIVE: "account_inactive",
	CARD_UNREADABLE: "card_unreadable",
	NFC_DISABLED: "nfc_disabled",
	CAMERA_DENIED: "camera_denied",
	DEVICE: "device",
} as const

const VERIFICATION = {
	PIN: "pin",
	CARD: "card",
	QR_CODE: "qrCode",
	BARCODE: "barcode",
} as const

export type Verification = (typeof VERIFICATION)[keyof typeof VERIFICATION]

const METHOD_OF_VERIFICATION: Readonly<Record<Verification, LoginMethod>> = {
	[VERIFICATION.PIN]: LOGIN_METHOD.PIN,
	[VERIFICATION.CARD]: LOGIN_METHOD.CARD,
	[VERIFICATION.QR_CODE]: LOGIN_METHOD.QR,
	[VERIFICATION.BARCODE]: LOGIN_METHOD.BARCODE,
}

const PIN_NOTICE = {
	HINT: "hint",
	WRONG_PIN_DELAY: "wrong_pin_delay",
	WRONG_PIN_RETRY: "wrong_pin_retry",
	CHALLENGE_RETRY: "challenge_retry",
	METHOD_DISABLED: "method_disabled",
	TECHNICAL_ERROR: "technical_error",
} as const

type PinNotice = (typeof PIN_NOTICE)[keyof typeof PIN_NOTICE]

export type UnlockFailure = (typeof UNLOCK_FAILURE)[keyof typeof UNLOCK_FAILURE]

export type UnlockPhase =
	| { kind: typeof UNLOCK_PHASE.LOADING }
	| { kind: typeof UNLOCK_PHASE.NO_ACCOUNT }
	| { kind: typeof UNLOCK_PHASE.ENTRY; notice: PinNotice; delayed: boolean }
	| { kind: typeof UNLOCK_PHASE.READING_CARD }
	| { kind: typeof UNLOCK_PHASE.READING_CODE }
	| { kind: typeof UNLOCK_PHASE.VERIFYING; verification: Verification }
	| { kind: typeof UNLOCK_PHASE.FAILED; failure: UnlockFailure }
	| { kind: typeof UNLOCK_PHASE.SIGNED_IN; session: Session; verification: Verification }

export interface Unlock {
	phase: UnlockPhase
	heading: string
	message: PinMessage
	verifying: boolean
	account: UnlockAccount | undefined
	pin: string
	resumesSession: boolean
	digit: (digit: string) => void
	erase: () => void
	confirm: () => void
	readCard: () => void
	cancelCardReading: () => void
	readQrCode: () => void
	readBarcode: () => void
	retry: () => void
}

const READING_CARD: UnlockPhase = { kind: UNLOCK_PHASE.READING_CARD }
const READING_CODE: UnlockPhase = { kind: UNLOCK_PHASE.READING_CODE }

function entry(notice: PinNotice = PIN_NOTICE.HINT, delayed = false): UnlockPhase {
	return { kind: UNLOCK_PHASE.ENTRY, notice, delayed }
}

function verificationOf(phase: UnlockPhase): Verification | undefined {
	return phase.kind === UNLOCK_PHASE.VERIFYING || phase.kind === UNLOCK_PHASE.SIGNED_IN ? phase.verification : undefined
}

function headingOf(phase: UnlockPhase, texts: Texts): string {
	const verification = verificationOf(phase)
	return verification === undefined ? texts.unlock.heading : texts.unlock.verifying.heading[verification]
}

function noticeOf(notice: PinNotice, texts: Texts): PinMessage {
	switch (notice) {
		case PIN_NOTICE.HINT:
			return { text: texts.unlock.hint, tone: TEXT_TONE.MUTED }
		case PIN_NOTICE.WRONG_PIN_DELAY:
			return { text: texts.unlock.wrongPin.delay, tone: TEXT_TONE.ERROR }
		case PIN_NOTICE.WRONG_PIN_RETRY:
			return { text: texts.unlock.wrongPin.retry, tone: TEXT_TONE.ERROR }
		case PIN_NOTICE.CHALLENGE_RETRY:
			return { text: texts.unlock.challenge, tone: TEXT_TONE.MUTED }
		case PIN_NOTICE.METHOD_DISABLED:
			return { text: texts.unlock.methodDisabled, tone: TEXT_TONE.ERROR }
		case PIN_NOTICE.TECHNICAL_ERROR:
			return { text: texts.unlock.technicalError, tone: TEXT_TONE.ERROR }
		default:
			return notice satisfies never
	}
}

function messageOf(phase: UnlockPhase, texts: Texts): PinMessage {
	if (phase.kind === UNLOCK_PHASE.ENTRY) {
		return noticeOf(phase.notice, texts)
	}
	if (verificationOf(phase) === undefined) {
		return noticeOf(PIN_NOTICE.HINT, texts)
	}
	return { text: texts.unlock.verifying.body, tone: TEXT_TONE.MUTED }
}

function failed(failure: UnlockFailure): UnlockPhase {
	return { kind: UNLOCK_PHASE.FAILED, failure }
}

// CAP-002-R18
function belongsToShownAccount(phase: UnlockPhase): boolean {
	return phase.kind === UNLOCK_PHASE.ENTRY || phase.kind === UNLOCK_PHASE.FAILED
}

function retryAfterOf(error: unknown): number | undefined {
	return error instanceof ApiProblemError ? error.retryAfterSeconds : undefined
}

const LOGIN_ERRORS = { codeOf: errorCodeOf, retryAfterOf, isNoConnection }
const FIRST_DIGIT_LENGTH = 1

function sessionHasEnded(markerEnd: string, now: Date): boolean {
	const end = lastSessionEnd() ?? (markerEnd === "" ? undefined : markerEnd)
	return end !== undefined && new Date(end) <= now
}

// CAP-001-R20, E4
function phaseOfRejection(code: string): UnlockPhase {
	if (code === ERROR_CODE.LOGIN_FAILED) {
		return entry(PIN_NOTICE.WRONG_PIN_RETRY)
	}
	if (code === ERROR_CODE.ATTEMPTS_EXHAUSTED) {
		return failed(UNLOCK_FAILURE.BLOCKED)
	}
	if (code === ERROR_CODE.FULL_LOGIN_REQUIRED) {
		return failed(UNLOCK_FAILURE.FULL_LOGIN_REQUIRED)
	}
	if (code === ERROR_CODE.ACCOUNT_INACTIVE) {
		return failed(UNLOCK_FAILURE.ACCOUNT_INACTIVE)
	}
	if (isDeviceErrorCode(code)) {
		return failed(UNLOCK_FAILURE.DEVICE)
	}
	if (code === ERROR_CODE.CHALLENGE_INVALID) {
		return entry(PIN_NOTICE.CHALLENGE_RETRY)
	}
	// CAP-012-R24, E34
	if (code === ERROR_CODE.APP_VERSION_UNSUPPORTED) {
		return entry()
	}
	return entry(PIN_NOTICE.TECHNICAL_ERROR)
}

export function useUnlock(watchesCard: boolean): Unlock {
	const strings = useTexts()
	const scanQrCode = useCodeScan()
	const scanBarcode = useCodeScan(ROUTE.EMPLOYEE_CODE_SCAN)
	const [phase, setPhase] = useState<UnlockPhase>({ kind: UNLOCK_PHASE.LOADING })
	const { pin, digit, erase, clear } = usePinEntry()
	const [sessionEnded, setSessionEnded] = useState(false)
	const stored = useCurrentAccount()
	const selected = useSelectedUnlockAccount()
	const delay = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
	const [challenges] = useState(() => new ChallengeReserve(pinLoginApi))
	const owner = stored.account
	const account = selected ?? owner

	useEffect(() => {
		if (!stored.loaded) {
			return
		}
		if (stored.account === undefined) {
			setPhase({ kind: UNLOCK_PHASE.NO_ACCOUNT })
			return
		}
		const ended = sessionHasEnded(stored.account.sessionEnd, new Date())
		setSessionEnded(ended)
		const signedOut = sessionClosure() === SESSION_CLOSURE.SIGNED_OUT
		setPhase(ended && !signedOut ? failed(UNLOCK_FAILURE.SESSION_ENDED) : entry())
	}, [stored])

	useEffect(() => () => clearTimeout(delay.current), [])

	// CAP-002-R18, CAP-002-S23
	const shown = useRef(selected)
	useEffect(() => {
		if (shown.current === selected) {
			return
		}
		shown.current = selected
		clearTimeout(delay.current)
		clear()
		setPhase((current) => (belongsToShownAccount(current) ? entry() : current))
	}, [selected, clear])

	const settle = useCallback(async (outcome: QuickLoginOutcome, verification: Verification) => {
		switch (outcome.kind) {
			case QUICK_LOGIN_OUTCOME.SESSION: {
				const personalNumber = outcome.session.user.personal_number
				if (personalNumber === undefined) {
					throw new Error("the session names no personal number")
				}
				await cryptoAndKeys().setCurrentPinAccount(personalNumber, outcome.session.session_end)
				rememberEffectiveConfiguration(outcome.session.effective_configuration)
				rememberSession(outcome.session)
				selectUnlockAccount(undefined)
				setPhase({ kind: UNLOCK_PHASE.SIGNED_IN, session: outcome.session, verification })
				return
			}
			case QUICK_LOGIN_OUTCOME.NO_LOCAL_ACCOUNT:
				setPhase({ kind: UNLOCK_PHASE.NO_ACCOUNT })
				return
			case QUICK_LOGIN_OUTCOME.NO_CONNECTION:
				setPhase(failed(UNLOCK_FAILURE.OFFLINE))
				return
			case QUICK_LOGIN_OUTCOME.PROVIDER_UNAVAILABLE:
				setPhase(failed(UNLOCK_FAILURE.PROVIDER_UNAVAILABLE))
				return
			case QUICK_LOGIN_OUTCOME.FAILED:
				setPhase(entry(PIN_NOTICE.TECHNICAL_ERROR))
				return
			case QUICK_LOGIN_OUTCOME.REJECTED: {
				if (outcome.code === ERROR_CODE.LOGIN_FAILED && outcome.retryAfterSeconds !== undefined) {
					setPhase(entry(PIN_NOTICE.WRONG_PIN_DELAY, true))
					delay.current = setTimeout(
						() => setPhase(entry(PIN_NOTICE.WRONG_PIN_RETRY)),
						millisecondsOf(outcome.retryAfterSeconds),
					)
					return
				}
				if (outcome.code === ERROR_CODE.METHOD_DISABLED) {
					// CAP-001-S09
					withdrawLoginMethod(METHOD_OF_VERIFICATION[verification])
					setPhase(entry(PIN_NOTICE.METHOD_DISABLED))
					return
				}
				setPhase(phaseOfRejection(outcome.code))
				return
			}
			default:
				return outcome satisfies never
		}
	}, [])

	const verify = useCallback(
		async (verification: Verification, signIn: () => Promise<QuickLoginOutcome>) => {
			setPhase({ kind: UNLOCK_PHASE.VERIFYING, verification })
			try {
				await settle(await signIn(), verification)
			} catch (failure) {
				console.warn("quick sign-in failed", failure)
				setPhase(entry(PIN_NOTICE.TECHNICAL_ERROR))
			}
		},
		[settle],
	)

	const resumesSession = !sessionEnded && account?.personalNumber === owner?.personalNumber

	useOwnerLanguage(resumesSession ? owner?.personalNumber : undefined)

	const accepting = phase.kind === UNLOCK_PHASE.ENTRY && !phase.delayed

	// CAP-001-R24, CAP-001-R07
	const isFirstDigit = pin.length === FIRST_DIGIT_LENGTH
	useEffect(() => {
		if (accepting && isFirstDigit) {
			challenges.prepare()
		}
	}, [accepting, isFirstDigit, challenges])

	const confirm = useCallback(() => {
		if (!accepting || account === undefined || !isPinEntryComplete(pin)) {
			return
		}
		const entered = pin
		clear()
		void verify(VERIFICATION.PIN, () =>
			signInWithPin(
				{
					...LOGIN_ERRORS,
					api: { ...pinLoginApi, issueChallenge: () => challenges.issueChallenge() },
					prover: cryptoAndKeys(),
				},
				{ personalNumber: account.personalNumber, pin: entered },
			),
		)
	}, [accepting, account, pin, clear, verify, challenges])

	const settleReading = useCallback(
		async (reading: CardReading) => {
			switch (reading.kind) {
				case CARD_READING.READ:
					await verify(VERIFICATION.CARD, () =>
						signInWithCard(
							{ ...LOGIN_ERRORS, api: cardLoginApi, signer: cryptoAndKeys() },
							cardIdentifierOf(reading.tagId),
						),
					)
					return
				case CARD_READING.CANCELLED:
					setPhase(entry())
					return
				case CARD_READING.TIMED_OUT:
				case CARD_READING.FAILED:
					setPhase(failed(UNLOCK_FAILURE.CARD_UNREADABLE))
					return
				default:
					return reading satisfies never
			}
		},
		[verify],
	)

	// CAP-001-R09
	const watching =
		watchesCard && (accepting || phase.kind === UNLOCK_PHASE.READING_CARD) && nfcReader().readsWithoutPrompt
	useEffect(() => {
		if (!watching) {
			return
		}
		let current = true
		void nfcReader()
			.watchCard()
			.then((reading) => {
				if (current && reading.kind !== CARD_READING.CANCELLED) {
					clear()
					void settleReading(reading)
				}
			})
		return () => {
			current = false
			void nfcReader().cancel()
		}
	}, [watching, clear, settleReading])

	const canReadCard =
		accepting || (phase.kind === UNLOCK_PHASE.FAILED && phase.failure === UNLOCK_FAILURE.CARD_UNREADABLE)

	const readCard = useCallback(() => {
		if (!canReadCard) {
			return
		}
		clear()
		if (nfcReader().readsWithoutPrompt) {
			void nfcReader()
				.isEnabled()
				.then((isEnabled) => setPhase(isEnabled ? READING_CARD : failed(UNLOCK_FAILURE.NFC_DISABLED)))
			return
		}
		setPhase(READING_CARD)
		void nfcReader().readCard(strings.unlock.card.instruction).then(settleReading)
	}, [canReadCard, clear, settleReading, strings])

	// CAP-001-R29
	const cancelCardReading = useCallback(() => {
		setPhase((current) => (current.kind === UNLOCK_PHASE.READING_CARD ? entry() : current))
	}, [])

	const readCode = useCallback(
		(
			scan: () => Promise<CodeScan>,
			verification: Verification,
			signIn: (content: string) => Promise<QuickLoginOutcome>,
		) => {
			if (!accepting) {
				return
			}
			clear()
			setPhase(READING_CODE)
			void (async () => {
				const scanned = await scan()
				switch (scanned.kind) {
					case CODE_SCAN.SCANNED:
						await verify(verification, () => signIn(scanned.content))
						return
					case CODE_SCAN.CANCELLED:
						setPhase(entry())
						return
					case CODE_SCAN.CAMERA_DENIED:
						setPhase(failed(UNLOCK_FAILURE.CAMERA_DENIED))
						return
					default:
						return scanned satisfies never
				}
			})().catch((failure: unknown) => {
				console.warn("the code could not be read", failure)
				setPhase(entry())
			})
		},
		[accepting, clear, verify],
	)

	// CAP-001-S28, CAP-001-S29
	const readQrCode = useCallback(() => {
		readCode(scanQrCode, VERIFICATION.QR_CODE, (content) =>
			signInWithQrCode({ ...LOGIN_ERRORS, api: qrCodeLoginApi, signer: cryptoAndKeys() }, content),
		)
	}, [readCode, scanQrCode])

	// identity.yaml loginWithBarcode
	const readBarcode = useCallback(() => {
		readCode(scanBarcode, VERIFICATION.BARCODE, (content) =>
			signInWithBarcode({ ...LOGIN_ERRORS, api: barcodeLoginApi, signer: cryptoAndKeys() }, content),
		)
	}, [readCode, scanBarcode])

	const retry = useCallback(() => {
		clear()
		setPhase(entry())
	}, [clear])

	return {
		phase,
		heading: headingOf(phase, strings),
		message: messageOf(phase, strings),
		verifying: verificationOf(phase) !== undefined,
		account,
		pin,
		resumesSession,
		digit,
		erase,
		confirm,
		readCard,
		cancelCardReading,
		readQrCode,
		readBarcode,
		retry,
	}
}
