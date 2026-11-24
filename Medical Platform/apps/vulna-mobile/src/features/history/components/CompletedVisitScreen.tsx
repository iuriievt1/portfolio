import { FlatList, View } from "react-native"
import type { EncounterAcquisitionItem } from "../../../api/encounters"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { Body } from "../../../ui/typography"
import { BrowseScreen } from "../../patient/components/BrowseScreen"
import { MoreFooter } from "../../remote/components/MoreFooter"
import { MORE, MORE_THRESHOLD, type PagedContent } from "../../remote/hooks/use-paged-content"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { RECORD_NOTE } from "../../upload/record-note"
import { RecordRow } from "../../visit/components/RecordRow"
import { visitTitleOf, visitWhenOf } from "../../visit/visit-view"
import type { CompletedVisit } from "../hooks/use-completed-visit"

interface Props {
	patient: Patient
	state: LoadState<PagedContent<EncounterAcquisitionItem, CompletedVisit>>
	onBack: () => void
	onRetry: () => void
	onMore: () => void
	onOpenRecord: (record: EncounterAcquisitionItem) => void
}

// CAP-014-R21, CAP-014-R22, E105, Figma 07 A.2
export function CompletedVisitScreen({ patient, state, onBack, onRetry, onMore, onOpenRecord }: Props) {
	const texts = useTexts()
	const encounter = state.kind === LOAD_STATE.READY ? state.encounter : undefined
	const title = encounter === undefined ? "" : visitTitleOf(visitWhenOf(encounter, new Date(), texts.language), texts)
	return (
		<BrowseScreen
			title={title}
			patient={patient}
			state={state}
			serverErrorHeading={texts.visit.loadFailed}
			onBack={onBack}
			onRetry={onRetry}
		>
			{({ items, more }) => (
				<FlatList
					data={items}
					keyExtractor={(record) => record.acquisition_id}
					renderItem={({ item: record }) => (
						<View>
							<RecordRow record={record} note={RECORD_NOTE.NONE} menu={undefined} onOpen={() => onOpenRecord(record)} />
							<InsetDivider />
						</View>
					)}
					contentContainerClassName="pt-6 pb-safe-gap-or-sheet"
					onEndReached={onMore}
					onEndReachedThreshold={MORE_THRESHOLD}
					ListFooterComponent={
						more === MORE.NONE ? (
							<Body className="px-screen pt-4">{texts.history.completed}</Body>
						) : (
							<MoreFooter more={more} onRetry={onMore} />
						)
					}
				/>
			)}
		</BrowseScreen>
	)
}
