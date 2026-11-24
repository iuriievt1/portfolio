import { ERROR_CODE } from "@ansora/contracts"
import {
	bindCard,
	CARD_READING,
	type CardBinding,
	type CardBindingReceipt,
	cardIdentifierOf,
	cryptoAndKeys,
	isDeviceErrorCode,
	nfcReader,
} from "@ansora/core-mobile"
import { useRouter } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import { AppState } from "react-native"
import { errorCodeOf } from "../../../api/api-error"
import { cardBindingApi } from "../../../api/login"
import { currentTexts } from "../../../i18n/language-store"
import { CODE_SCAN, useCodeScan } from "../../code-scan/hooks/use-code-scan"

export const CARD_ASSIGN_PHASE = {
	SCANNING_CODE: "scanning_code",
	READING_CARD: "reading_card",
	BINDING: "binding",
	BOUND: "bound",
	FAILED: "failed",
} as const

export const CARD_ASSIGN_FAILURE = {
	CODE_INVALID: "code_invalid",
	CARD_TAKEN: "card_taken",
	CARD_UNREADABLE: "card_unreadable",
	NFC_DISABLED: "nfc_disabled",
	CAMERA_DENIED: "camera_denied",
	OFFLINE: "offline",
	DEVICE: "device",
} as const

export type CardAssignFailure = (typeof CARD_ASSIGN_FAILURE)[keyof typeof CARD_ASSIGN_FAILURE]

export type CardAssignPhase =
	| { kind: typeof CARD_ASSIGN_PHASE.SCANNING_CODE }
	| { kind: typeof CARD_ASSIGN_PHASE.READING_CARD }
	| { kind: typeof CARD_ASSIGN_PHASE.BINDING }
	| { kind: typeof CARD_ASSIGN_PHASE.BOUND; receipt: CardBindingReceipt }
	| { kind: typeof CARD_ASSIGN_PHASE.FAILED; failure: CardAssignFailure }

export interface CardAssign {
	phase: CardAssignPhase
	readCard: () => void
	bindAgain: () => void
	close: () => void
}

const BINDING_PORTS = { api: cardBindingApi, codeOf: errorCodeOf }

function failed(failure: CardAssignFailure): CardAssignPhase {
	return { kind: CARD_ASSIGN_PHASE.FAILED, failure }
}

function failureOf(error: unknown): CardAssignFailure {
	const code = errorCodeOf(error)
	if (code === undefined) {
		return CARD_ASSIGN_FAILURE.OFFLINE
	}
	if (code === ERROR_CODE.CARD_ALREADY_BOUND) {
		return CARD_ASSIGN_FAILURE.CARD_TAKEN
	}
	if (isDeviceErrorCode(code)) {
		return CARD_ASSIGN_FAILURE.DEVICE
	}
	return CARD_ASSIGN_FAILURE.CODE_INVALID
}

export function useCardAssign(): CardAssign {
	const router = useRouter()
	const scanCode = useCodeScan()
	const [phase, setPhase] = useState<CardAssignPhase>({ kind: CARD_ASSIGN_PHASE.SCANNING_CODE })
	const bindingCode = useRef<string | undefined>(undefined)
	const binding = useRef<CardBinding | undefined>(undefined)

	const shown = useRef(true)
	const close = useCallback(() => router.back(), [router])

	useEffect(
		() => () => {
			shown.current = false
			void nfcReader().cancel()
		},
		[],
	)

	const bind = useCallback(async (next: CardBinding) => {
		binding.current = next
		setPhase({ kind: CARD_ASSIGN_PHASE.BINDING })
		try {
			const receipt = await bindCard({ ...BINDING_PORTS, signer: cryptoAndKeys() }, next)
			setPhase({ kind: CARD_ASSIGN_PHASE.BOUND, receipt })
		} catch (error) {
			setPhase(failed(failureOf(error)))
		}
	}, [])

	const readCard = useCallback(() => {
		const code = bindingCode.current
		if (code === undefined) {
			return
		}
		void (async () => {
			const isNfcDisabled = nfcReader().readsWithoutPrompt && !(await nfcReader().isEnabled())
			if (isNfcDisabled) {
				setPhase(failed(CARD_ASSIGN_FAILURE.NFC_DISABLED))
				return
			}
			setPhase({ kind: CARD_ASSIGN_PHASE.READING_CARD })
			const reading = await nfcReader().readCard(currentTexts().cardBinding.tapCard.text)
			switch (reading.kind) {
				case CARD_READING.READ:
					await bind({ identifier: cardIdentifierOf(reading.tagId), bindingCode: code })
					return
				case CARD_READING.CANCELLED:
					if (shown.current) {
						close()
					}
					return
				case CARD_READING.TIMED_OUT:
				case CARD_READING.FAILED:
					setPhase(failed(CARD_ASSIGN_FAILURE.CARD_UNREADABLE))
					return
				default:
					return reading satisfies never
			}
		})()
	}, [bind, close])

	const isNfcDisabledShown =
		phase.kind === CARD_ASSIGN_PHASE.FAILED && phase.failure === CARD_ASSIGN_FAILURE.NFC_DISABLED
	useEffect(() => {
		if (!isNfcDisabledShown) {
			return
		}
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				readCard()
			}
		})
		return () => subscription.remove()
	}, [isNfcDisabledShown, readCard])

	const bindAgain = useCallback(() => {
		if (binding.current !== undefined) {
			void bind(binding.current)
		}
	}, [bind])

	const started = useRef(false)
	useEffect(() => {
		if (started.current) {
			return
		}
		started.current = true
		void (async () => {
			const scan = await scanCode()
			switch (scan.kind) {
				case CODE_SCAN.SCANNED:
					bindingCode.current = scan.content
					readCard()
					return
				case CODE_SCAN.CANCELLED:
					close()
					return
				case CODE_SCAN.CAMERA_DENIED:
					setPhase(failed(CARD_ASSIGN_FAILURE.CAMERA_DENIED))
					return
				default:
					return scan satisfies never
			}
		})().catch((failure: unknown) => {
			console.warn("the binding code could not be read", failure)
			close()
		})
	}, [scanCode, close, readCard])

	return { phase, readCard, bindAgain, close }
}
