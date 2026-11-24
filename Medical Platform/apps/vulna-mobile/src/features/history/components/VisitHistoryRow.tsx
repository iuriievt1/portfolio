import { View } from "react-native"
import type { Encounter } from "../../../api/encounters"
import { useTexts } from "../../../i18n/language-store"
import { OpenRow } from "../../../ui/OpenRow"
import { StatusPill } from "../../../ui/StatusPill"
import { Detail, Label } from "../../../ui/typography"
import { visitRowOf } from "../visit-sections"
import { DateTile } from "./DateTile"

interface Props {
	visit: Encounter
	onOpen: () => void
}

// CAP-014-R24, E109, Vulna / Patient / Visit history row
export function VisitHistoryRow({ visit, onOpen }: Props) {
	const row = visitRowOf(visit, useTexts())
	return (
		<OpenRow onPress={onOpen}>
			<DateTile day={row.day} weekday={row.weekday} />
			<View className="flex-1 gap-1">
				<Label numberOfLines={1}>{row.time}</Label>
				<View className="flex-row items-center gap-2">
					{row.status === undefined ? null : <StatusPill tone={row.status.tone} label={row.status.label} />}
					{row.records === undefined ? null : <Detail numberOfLines={1}>{row.records}</Detail>}
				</View>
			</View>
		</OpenRow>
	)
}
