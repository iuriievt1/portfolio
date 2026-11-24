import type { ReactNode } from "react"
import { Pressable, View } from "react-native"
import type { EncounterAcquisitionItem } from "../../../api/encounters"
import { useTexts } from "../../../i18n/language-store"
import { OpenIcon } from "../../../ui/icons/OpenIcon"
import { StatusPill } from "../../../ui/StatusPill"
import { Detail, Label } from "../../../ui/typography"
import type { RecordNote } from "../../upload/record-note"
import { recordDetailOf, recordStatusOf, recordTitleOf } from "../visit-view"
import { RecordKindIcon } from "./RecordKindIcon"

interface Props {
	record: EncounterAcquisitionItem
	note: RecordNote
	menu: ReactNode | undefined
	onOpen: (() => void) | undefined
}

// CAP-014-R22, CAP-014-R25, CAP-019-R29, CAP-015-R36, E93, E101, Q-076
export function RecordRow({ record, note, menu, onOpen }: Props) {
	const texts = useTexts()
	const status = recordStatusOf(record, texts)
	return (
		<View className="flex-row items-center">
			<Pressable
				className={`group min-h-14 flex-1 flex-row items-center gap-3 py-3 pl-screen ${menu === undefined ? "pr-screen" : ""}`}
				accessibilityRole="button"
				disabled={onOpen === undefined}
				onPress={onOpen}
			>
				<View className="absolute inset-0 hidden bg-foreground/10 group-active:flex" />
				<RecordKindIcon kind={record.kind} />
				<View className="flex-1 gap-1">
					<Label numberOfLines={1}>{recordTitleOf(record, texts)}</Label>
					<View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
						<StatusPill tone={status.tone} label={status.label} />
						<Detail>{recordDetailOf(record, texts, note)}</Detail>
					</View>
				</View>
				{onOpen === undefined ? null : <OpenIcon />}
			</Pressable>
			{menu === undefined ? null : <View className="pr-2">{menu}</View>}
		</View>
	)
}
