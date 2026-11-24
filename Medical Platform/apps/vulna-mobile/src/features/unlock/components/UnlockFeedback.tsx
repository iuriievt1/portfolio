import type { ReactNode } from "react"
import { useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import { ENTRY_OFFSET, type EntryAction } from "../../../ui/EntryLayout"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { CameraIcon } from "../../../ui/icons/CameraIcon"
import { ICON_LOOK } from "../../../ui/icons/icon-look"
import { LockKeyIcon } from "../../../ui/icons/LockKeyIcon"
import { NfcIcon } from "../../../ui/icons/NfcIcon"
import { RetryIcon } from "../../../ui/icons/RetryIcon"
import { SessionEndedIcon } from "../../../ui/icons/SessionEndedIcon"
import { WifiSlashIcon } from "../../../ui/icons/WifiSlashIcon"
import { countText } from "../../../utils/fill-text"
import { UNLOCK_FAILURE, type UnlockFailure } from "../hooks/use-unlock"

type ShownFailure = Exclude<UnlockFailure, typeof UNLOCK_FAILURE.DEVICE>

interface Props {
	failure: ShownFailure
	fullLoginIntervalSeconds: number | undefined
	isClosingQueued: boolean
	onRetry: () => void
	onReadCard: () => void
	onOpenSettings: () => void
	onOpenNfcSettings: () => void
	onSignInAgain: () => void
	onSignInWithAccount: () => void
	onChangeAccount: () => void
}

interface Feedback {
	icon: ReactNode
	heading: string
	body: string
	action: EntryAction
	secondary?: EntryAction
}

const SECONDS_PER_DAY = 86_400

export function UnlockFeedback(props: Props) {
	const strings = useTexts()
	return <FeedbackScreen {...feedbackOf(props, strings)} offset={ENTRY_OFFSET.FEEDBACK} />
}

function feedbackOf(props: Props, strings: Texts): Feedback {
	const texts = strings.unlock
	const changeAccount = { label: texts.changeUser, onPress: props.onChangeAccount }
	switch (props.failure) {
		case UNLOCK_FAILURE.OFFLINE:
			return {
				icon: <WifiSlashIcon />,
				heading: texts.offline.heading,
				body: texts.offline.body,
				action: { label: texts.offline.action, onPress: props.onRetry },
			}
		case UNLOCK_FAILURE.BLOCKED:
			return {
				icon: <LockKeyIcon />,
				heading: texts.blocked.heading,
				body: `${texts.blocked.body}\n${texts.blocked.unlockNote}`,
				action: { label: texts.blocked.action, onPress: props.onSignInWithAccount },
				secondary: changeAccount,
			}
		case UNLOCK_FAILURE.SESSION_ENDED:
			return {
				icon: <SessionEndedIcon />,
				heading: texts.sessionEnded.heading,
				body: props.isClosingQueued
					? `${texts.sessionEnded.body}\n${texts.sessionEnded.closingQueued}`
					: texts.sessionEnded.body,
				action: { label: texts.sessionEnded.action, onPress: props.onSignInAgain },
				secondary: changeAccount,
			}
		case UNLOCK_FAILURE.FULL_LOGIN_REQUIRED:
			return {
				icon: <LockKeyIcon />,
				heading: texts.fullLogin.heading,
				body: fullLoginBody(props.fullLoginIntervalSeconds, strings),
				action: { label: texts.fullLogin.action, onPress: props.onSignInWithAccount },
				secondary: changeAccount,
			}
		case UNLOCK_FAILURE.PROVIDER_UNAVAILABLE:
			return {
				icon: <RetryIcon />,
				heading: texts.providerUnavailable.heading,
				body: texts.providerUnavailable.body,
				action: { label: texts.providerUnavailable.action, onPress: props.onRetry },
				secondary: changeAccount,
			}
		case UNLOCK_FAILURE.CARD_UNREADABLE:
			return {
				icon: <NfcIcon look={ICON_LOOK.FEEDBACK} />,
				heading: texts.cardUnreadable.heading,
				body: texts.cardUnreadable.body,
				action: { label: texts.cardUnreadable.action, onPress: props.onReadCard },
				secondary: { label: texts.cardUnreadable.secondary, onPress: props.onRetry },
			}
		case UNLOCK_FAILURE.NFC_DISABLED:
			return {
				icon: <NfcIcon look={ICON_LOOK.FEEDBACK} />,
				heading: texts.nfcDisabled.heading,
				body: texts.nfcDisabled.body,
				action: { label: texts.nfcDisabled.action, onPress: props.onOpenNfcSettings },
				secondary: { label: texts.nfcDisabled.secondary, onPress: props.onRetry },
			}
		case UNLOCK_FAILURE.CAMERA_DENIED:
			return {
				icon: <CameraIcon look={ICON_LOOK.FEEDBACK} />,
				heading: texts.cameraDenied.heading,
				body: texts.cameraDenied.body,
				action: { label: texts.cameraDenied.action, onPress: props.onRetry },
				secondary: { label: texts.cameraDenied.secondary, onPress: props.onOpenSettings },
			}
		case UNLOCK_FAILURE.ACCOUNT_INACTIVE:
			return {
				icon: <LockKeyIcon />,
				heading: texts.accountInactive.heading,
				body: texts.accountInactive.body,
				action: changeAccount,
			}
		default:
			return props.failure satisfies never
	}
}

function fullLoginBody(seconds: number | undefined, strings: Texts): string {
	const texts = strings.unlock.fullLogin
	if (seconds === undefined) {
		return texts.bodyWithoutInterval
	}
	const days = Math.round(seconds / SECONDS_PER_DAY)
	return countText(texts.body, days, strings.language)
}
