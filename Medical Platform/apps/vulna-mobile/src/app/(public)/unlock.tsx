import { LOGIN_METHOD, LOGIN_START_REASON, type LoginStartReason } from "@ansora/contracts"
import { nfcReader } from "@ansora/core-mobile"
import { Redirect, useIsFocused, useRouter } from "expo-router"
import { useCallback, useEffect } from "react"
import { useLoadingCover } from "../../features/bootstrap/loading-cover"
import { useNfcSupport } from "../../features/nfc/hooks/use-nfc-support"
import { effectiveConfiguration, offersLoginMethod } from "../../features/session/effective-configuration-store"
import { PinScreen } from "../../features/unlock/components/PinScreen"
import { UnlockFeedback } from "../../features/unlock/components/UnlockFeedback"
import { UNLOCK_FAILURE, UNLOCK_PHASE, useUnlock } from "../../features/unlock/hooks/use-unlock"
import { useClosingQueuedFor } from "../../features/upload/hooks/use-closing-queued-for"
import { useTexts } from "../../i18n/language-store"
import { ROUTE } from "../../navigation/routes"
import { ConfirmDialog } from "../../ui/ConfirmDialog"
import { openNfcSettings } from "../../utils/open-nfc-settings"
import { openSettings } from "../../utils/open-settings"

export default function Unlock() {
	const strings = useTexts()
	const router = useRouter()
	const focused = useIsFocused()
	const cardSupported = useNfcSupport()
	const cardOffered = cardSupported && offersLoginMethod(LOGIN_METHOD.CARD)
	const unlock = useUnlock(focused && cardOffered)
	const { phase, account } = unlock
	const isClosingQueued = useClosingQueuedFor(account?.personalNumber)
	const isLoading = phase.kind === UNLOCK_PHASE.LOADING || account === undefined
	const leaves =
		phase.kind === UNLOCK_PHASE.NO_ACCOUNT ||
		(phase.kind === UNLOCK_PHASE.FAILED && phase.failure === UNLOCK_FAILURE.DEVICE)
	useLoadingCover(isLoading || leaves)

	useEffect(() => {
		if (phase.kind === UNLOCK_PHASE.SIGNED_IN) {
			router.replace(ROUTE.HOME)
		}
	}, [phase, router])

	const signInWithAccount = useCallback(
		(reason: LoginStartReason) => {
			router.push({ pathname: ROUTE.SIGN_IN, params: { reason, account: account?.personalNumber } })
		},
		[router, account],
	)
	const changeAccount = useCallback(() => router.push(ROUTE.CHANGE_ACCOUNT), [router])
	const assignCard = useCallback(() => router.push(ROUTE.CARD_ASSIGN), [router])

	if (phase.kind === UNLOCK_PHASE.NO_ACCOUNT) {
		return <Redirect href={ROUTE.SIGN_IN} />
	}
	if (isLoading) {
		return null
	}
	if (phase.kind === UNLOCK_PHASE.FAILED) {
		if (phase.failure === UNLOCK_FAILURE.DEVICE) {
			return <Redirect href={ROUTE.ENTRY} />
		}
		const reason =
			phase.failure === UNLOCK_FAILURE.BLOCKED
				? LOGIN_START_REASON.PIN_ATTEMPTS_EXHAUSTED
				: LOGIN_START_REASON.INTERVAL_EXPIRED
		return (
			<UnlockFeedback
				failure={phase.failure}
				fullLoginIntervalSeconds={effectiveConfiguration()?.full_login_interval_seconds}
				isClosingQueued={isClosingQueued}
				onRetry={unlock.retry}
				onReadCard={unlock.readCard}
				onOpenSettings={openSettings}
				onOpenNfcSettings={openNfcSettings}
				onSignInAgain={unlock.retry}
				onSignInWithAccount={() => signInWithAccount(reason)}
				onChangeAccount={changeAccount}
			/>
		)
	}
	const texts = strings.unlock
	const isReadingCardHere = phase.kind === UNLOCK_PHASE.READING_CARD && nfcReader().readsWithoutPrompt
	return (
		<>
			<PinScreen
				heading={unlock.heading}
				message={unlock.message}
				pin={unlock.pin}
				locked={
					(phase.kind === UNLOCK_PHASE.ENTRY && phase.delayed) ||
					phase.kind === UNLOCK_PHASE.READING_CARD ||
					phase.kind === UNLOCK_PHASE.READING_CODE
				}
				verifying={unlock.verifying}
				accountName={account.displayName}
				action={unlock.resumesSession ? texts.unlock : texts.signIn}
				methods={{
					qrCode: offersLoginMethod(LOGIN_METHOD.QR),
					barcode: offersLoginMethod(LOGIN_METHOD.BARCODE),
					card: cardOffered,
					onQrCode: unlock.readQrCode,
					onBarcode: unlock.readBarcode,
					onCard: unlock.readCard,
					onAssignCard: effectiveConfiguration()?.card_binding_offered === true ? assignCard : undefined,
					onAccount: () => signInWithAccount(LOGIN_START_REASON.UNLOCK),
				}}
				onDigit={unlock.digit}
				onErase={unlock.erase}
				onConfirm={unlock.confirm}
				onChangeAccount={changeAccount}
			/>
			{isReadingCardHere ? (
				<ConfirmDialog
					title={texts.card.heading}
					body={texts.card.body}
					secondary={{ label: texts.card.cancel, onPress: unlock.cancelCardReading }}
				/>
			) : null}
		</>
	)
}
