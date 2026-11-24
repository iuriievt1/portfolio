import { ScrollView, View } from "react-native"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import { useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { SheetHeader } from "../../../ui/SheetHeader"
import { Spinner } from "../../../ui/Spinner"
import { Body } from "../../../ui/typography"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { useQueuedRecordMarks } from "../../upload/hooks/use-queued-record-marks"
import { recordNoteOf } from "../../upload/record-note"
import type { OwnDrafts } from "../hooks/use-own-drafts"
import { OwnDraftRow } from "./OwnDraftRow"

interface Props {
	state: LoadState<OwnDrafts>
	onRetry: () => void
	onClose: () => void
	onContinue: (draft: AcquisitionDraftSummary) => void
	onDiscard: (draft: AcquisitionDraftSummary) => void
}

// CAP-015-R17, CAP-015-R18, CAP-015-R29, CAP-015-S14, CAP-002-R17, E70
export function OwnDraftsSheet({ state, onRetry, onClose, onContinue, onDiscard }: Props) {
	const texts = useTexts().drafts
	return (
		<View className="flex-1 bg-card">
			<SheetHeader title={texts.title} closeLabel={texts.close} onClose={onClose} />
			<OwnDraftsContent state={state} onRetry={onRetry} onContinue={onContinue} onDiscard={onDiscard} />
		</View>
	)
}

function OwnDraftsContent({ state, onRetry, onContinue, onDiscard }: Omit<Props, "onClose">) {
	const texts = useTexts().drafts
	switch (state.kind) {
		case LOAD_STATE.LOADING:
			return (
				<View className="flex-1 items-center justify-center">
					<Spinner />
				</View>
			)
		case LOAD_STATE.FAILED:
			return <RemoteFailureState failure={state.failure} serverErrorHeading={texts.loadFailed} onRetry={onRetry} />
		case LOAD_STATE.READY:
			return <DraftList drafts={state.drafts} onContinue={onContinue} onDiscard={onDiscard} />
		default:
			return state satisfies never
	}
}

interface ListProps {
	drafts: readonly AcquisitionDraftSummary[]
	onContinue: (draft: AcquisitionDraftSummary) => void
	onDiscard: (draft: AcquisitionDraftSummary) => void
}

function DraftList({ drafts, onContinue, onDiscard }: ListProps) {
	const texts = useTexts().drafts
	const marks = useQueuedRecordMarks()
	const now = new Date()
	if (drafts.length === 0) {
		return <Body className="px-screen pt-6">{texts.empty}</Body>
	}
	return (
		<ScrollView contentContainerClassName="pt-4 pb-safe-gap-or-6">
			{drafts.map((draft) => (
				<View key={draft.acquisition_id}>
					<OwnDraftRow
						draft={draft}
						now={now}
						note={recordNoteOf(draft, marks)}
						onContinue={() => onContinue(draft)}
						onDiscard={() => onDiscard(draft)}
					/>
					<InsetDivider />
				</View>
			))}
		</ScrollView>
	)
}
