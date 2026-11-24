import { useTexts } from "../../../i18n/language-store"
import { ENTRY_OFFSET, type EntryAction } from "../../../ui/EntryLayout"
import { FeedbackScreen } from "../../../ui/FeedbackScreen"
import { ICON_LOOK } from "../../../ui/icons/icon-look"
import { NfcIcon } from "../../../ui/icons/NfcIcon"
import { CARD_ASSIGN_PHASE, type CardAssignPhase } from "../hooks/use-card-assign"

type StepPhase = Exclude<CardAssignPhase, { kind: typeof CARD_ASSIGN_PHASE.FAILED }>

interface Props {
	phase: StepPhase
	onClose: () => void
}

export function CardAssignStep({ phase, onClose }: Props) {
	const texts = useTexts().cardBinding
	switch (phase.kind) {
		case CARD_ASSIGN_PHASE.SCANNING_CODE:
			return <CardStep body={texts.scanCode.text} />
		case CARD_ASSIGN_PHASE.READING_CARD:
		case CARD_ASSIGN_PHASE.BINDING:
			return <CardStep body={texts.tapCard.text} />
		case CARD_ASSIGN_PHASE.BOUND:
			return (
				<CardStep
					body={texts.done.text}
					note={phase.receipt.user_display_name}
					action={{ label: texts.done.action, onPress: onClose }}
				/>
			)
		default:
			return phase satisfies never
	}
}

interface CardStepProps {
	heading?: string
	body: string
	note?: string
	action?: EntryAction
	secondary?: EntryAction
}

export function CardStep({ heading, body, note, action, secondary }: CardStepProps) {
	const strings = useTexts()
	return (
		<FeedbackScreen
			icon={<NfcIcon look={ICON_LOOK.FEEDBACK} />}
			heading={heading ?? strings.cardBinding.title}
			body={body}
			note={note}
			action={action}
			secondary={secondary}
			offset={ENTRY_OFFSET.FEEDBACK}
		/>
	)
}
