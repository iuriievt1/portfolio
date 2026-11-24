import { ENCOUNTER_STATUS } from "@ansora/contracts"
import { Pressable, View } from "react-native"
import type { Encounter } from "../../../api/encounters"
import { useTexts } from "../../../i18n/language-store"
import { PILL_TONE } from "../../../ui/pill-tone"
import { StatusPill } from "../../../ui/StatusPill"
import { Detail, Label, TEXT_TONE } from "../../../ui/typography"
import { todayVisitWhenOf, visitRecordsOf } from "../today-visits"

interface Props {
	visit: Encounter
	action: string | undefined
	onOpen: () => void
}

// CAP-014-R19, CAP-014-R25, E99
export function TodayVisitRow({ visit, action, onOpen }: Props) {
	const texts = useTexts()
	const isPlanned = visit.status === ENCOUNTER_STATUS.PLANNED
	const records = visitRecordsOf(visit, texts)
	return (
		<Pressable className="group min-h-16 flex-row items-center gap-2 py-2" accessibilityRole="button" onPress={onOpen}>
			<View className="absolute -inset-x-screen inset-y-0 hidden bg-foreground/10 group-active:flex" />
			<View className="flex-1 gap-1">
				<Label>{todayVisitWhenOf(visit, texts)}</Label>
				<View className="flex-row items-center gap-2">
					<StatusPill
						tone={isPlanned ? PILL_TONE.INFO : PILL_TONE.WARN}
						label={isPlanned ? texts.patient.status.planned : texts.patient.status.inProgress}
					/>
					{records === undefined ? null : <Detail>{records}</Detail>}
				</View>
			</View>
			<Detail className="font-medium" tone={TEXT_TONE.ACCENT}>
				{action ?? (isPlanned ? texts.patient.start : texts.patient.continue)}
			</Detail>
		</Pressable>
	)
}
