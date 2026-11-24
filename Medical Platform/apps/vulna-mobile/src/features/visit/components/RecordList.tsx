import type { ReactNode } from "react"
import { ScrollView, View } from "react-native"
import type { EncounterAcquisitionItem } from "../../../api/encounters"
import { InsetDivider } from "../../../ui/Divider"
import { type QueuedRecordMarks, recordNoteOf } from "../../upload/record-note"
import { RecordRow } from "./RecordRow"

interface Props {
	records: readonly EncounterAcquisitionItem[]
	marks: QueuedRecordMarks
	header: ReactNode | undefined
	bottomInset: number
	menuOf: (record: EncounterAcquisitionItem) => ReactNode | undefined
	openOf: (record: EncounterAcquisitionItem) => (() => void) | undefined
}

// CAP-014-R22, CAP-014-R25, CAP-019-R29, CAP-015-R36, E120, Q-076
export function RecordList({ records, marks, header, bottomInset, menuOf, openOf }: Props) {
	return (
		<ScrollView contentContainerClassName="pt-5" contentContainerStyle={{ paddingBottom: bottomInset }}>
			{header}
			{records.map((record) => (
				<View key={record.acquisition_id}>
					<RecordRow record={record} note={recordNoteOf(record, marks)} menu={menuOf(record)} onOpen={openOf(record)} />
					<InsetDivider />
				</View>
			))}
		</ScrollView>
	)
}
