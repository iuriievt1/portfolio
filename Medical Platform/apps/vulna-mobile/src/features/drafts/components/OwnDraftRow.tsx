import { Pressable, View } from "react-native"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { ActionMenu } from "../../../ui/ActionMenu"
import { MENU_LOOK, MENU_SYMBOL, type MenuAction } from "../../../ui/action-menu"
import { OpenIcon } from "../../../ui/icons/OpenIcon"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { Detail, Label } from "../../../ui/typography"
import { WaitingSince } from "../../overview/components/WaitingSince"
import { draftDetailOf, waitingSinceOf } from "../../overview/overview-rows"
import { patientNumberOf } from "../../patient/patient-identity"
import type { RecordNote } from "../../upload/record-note"

const DISCARD_ACTION = "discard"

interface Props {
	draft: AcquisitionDraftSummary
	now: Date
	note: RecordNote
	onContinue: () => void
	onDiscard: () => void
}

// CAP-015-R17, CAP-015-R29, CAP-015-R18, CAP-019-R29, CAP-015-R36, HIG-09, E57, E91, Q-076
export function OwnDraftRow({ draft, now, note, onContinue, onDiscard }: Props) {
	const texts = useTexts()
	const discard: MenuAction = {
		key: DISCARD_ACTION,
		label: texts.drafts.discard.action,
		symbol: MENU_SYMBOL.DISCARD,
		isDestructive: true,
		unavailableReason: undefined,
		onSelect: onDiscard,
	}
	return (
		<View className="flex-row items-center">
			<Pressable
				className="group min-h-14 flex-1 flex-row items-center gap-3 py-3 pl-screen"
				accessibilityRole="button"
				onPress={onContinue}
			>
				<PressedOverlay />
				<View className="flex-1 gap-1">
					<Label>{patientNumberOf(draft.patient)}</Label>
					<Detail>{draftDetailOf(draft, now, texts, note)}</Detail>
					<WaitingSince label={waitingSinceOf(draft, texts)} />
				</View>
				<OpenIcon />
			</Pressable>
			<View className="pr-2">
				<ActionMenu label={texts.drafts.menu} look={MENU_LOOK.ROW} actions={[discard]} />
			</View>
		</View>
	)
}
