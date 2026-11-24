import { useTexts } from "../../../i18n/language-store"
import { ENTRY_OFFSET, type EntryAction } from "../../../ui/EntryLayout"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { CameraIcon } from "../../../ui/icons/CameraIcon"
import { ICON_LOOK } from "../../../ui/icons/icon-look"
import { NoConnectionScreen } from "../../device/components/NoConnectionScreen"
import { CARD_ASSIGN_FAILURE, type CardAssignFailure } from "../hooks/use-card-assign"
import { CardStep } from "./CardAssignStep"

type ShownFailure = Exclude<CardAssignFailure, typeof CARD_ASSIGN_FAILURE.DEVICE>

interface Props {
	failure: ShownFailure
	onReadCard: () => void
	onBindAgain: () => void
	onOpenSettings: () => void
	onOpenNfcSettings: () => void
	onClose: () => void
}

export function CardAssignFeedback({
	failure,
	onReadCard,
	onBindAgain,
	onOpenSettings,
	onOpenNfcSettings,
	onClose,
}: Props) {
	const strings = useTexts()
	const texts = strings.cardBinding
	const cancel: EntryAction = { label: texts.cancel, onPress: onClose }
	switch (failure) {
		case CARD_ASSIGN_FAILURE.CODE_INVALID:
			return <CardStep body={texts.codeInvalid.text} action={cancel} />
		case CARD_ASSIGN_FAILURE.CARD_TAKEN:
			return <CardStep body={texts.cardTaken.text} action={cancel} />
		case CARD_ASSIGN_FAILURE.CARD_UNREADABLE:
			return (
				<CardStep
					heading={strings.unlock.cardUnreadable.heading}
					body={strings.unlock.cardUnreadable.body}
					action={{ label: strings.unlock.cardUnreadable.action, onPress: onReadCard }}
					secondary={cancel}
				/>
			)
		case CARD_ASSIGN_FAILURE.NFC_DISABLED:
			return (
				<CardStep
					heading={texts.nfcDisabled.heading}
					body={texts.nfcDisabled.body}
					action={{ label: texts.nfcDisabled.action, onPress: onOpenNfcSettings }}
					secondary={cancel}
				/>
			)
		case CARD_ASSIGN_FAILURE.CAMERA_DENIED:
			return (
				<FeedbackScreen
					icon={<CameraIcon look={ICON_LOOK.FEEDBACK} />}
					heading={strings.unlock.cameraDenied.heading}
					body={texts.cameraDenied.body}
					action={{ label: strings.unlock.cameraDenied.secondary, onPress: onOpenSettings }}
					secondary={cancel}
					offset={ENTRY_OFFSET.FEEDBACK}
				/>
			)
		case CARD_ASSIGN_FAILURE.OFFLINE:
			return <NoConnectionScreen onRetry={onBindAgain} />
		default:
			return failure satisfies never
	}
}
