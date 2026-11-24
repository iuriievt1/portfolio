import { View } from "react-native"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import type { ScheduledEncounterItem, UnfinishedEncounterItem } from "../../../api/encounters"
import type { RecentPatientItem } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { BrandScreen } from "../../../ui/Brand"
import { RemoteFailureState } from "../../remote/components/RemoteFailureState"
import { LOAD_STATE } from "../../remote/hooks/use-remote-content"
import type { OverviewState } from "../hooks/use-overview"
import type { PatientSearch } from "../hooks/use-patient-search"
import { OverviewHeader } from "./OverviewHeader"
import { OverviewSkeleton } from "./OverviewSkeleton"
import { OwnWork } from "./OwnWork"
import { PatientFinder, type PatientIdentification } from "./PatientFinder"

interface Props {
	userName: string
	overview: OverviewState
	withScheduled: boolean
	draftRows: number | undefined
	identification: PatientIdentification
	search: PatientSearch | undefined
	onRetry: () => void
	onDraft: (draft: AcquisitionDraftSummary) => void
	onAllDrafts: () => void
	onUnfinished: (item: UnfinishedEncounterItem) => void
	onScheduled: (item: ScheduledEncounterItem) => void
	onRecent: (item: RecentPatientItem) => void
	onLock: () => void
	onSettings: () => void
}

// CAP-013-R18, CAP-015-R29, CAP-014-R16, CHG-176, CHG-182, E89 to E91, clinical-workflow.yaml listRecentPatients
export function OverviewScreen({
	userName,
	overview,
	withScheduled,
	draftRows,
	identification,
	search,
	onRetry,
	onDraft,
	onAllDrafts,
	onUnfinished,
	onScheduled,
	onRecent,
	onLock,
	onSettings,
}: Props) {
	const texts = useTexts()
	return (
		<BrandScreen>
			<OverviewHeader userName={userName} onLock={onLock} onSettings={onSettings} />
			<View className="flex-1 rounded-t-sheet bg-background">
				{overview.kind === LOAD_STATE.FAILED && search?.isActive !== true ? (
					<RemoteFailureState
						failure={overview.failure}
						serverErrorHeading={texts.overview.loadFailed}
						onRetry={onRetry}
					/>
				) : (
					<PatientFinder identification={identification} search={search}>
						<Work
							overview={overview}
							withScheduled={withScheduled}
							draftRows={draftRows}
							onDraft={onDraft}
							onAllDrafts={onAllDrafts}
							onUnfinished={onUnfinished}
							onScheduled={onScheduled}
							onRecent={onRecent}
						/>
					</PatientFinder>
				)}
			</View>
		</BrandScreen>
	)
}

type WorkProps = Pick<
	Props,
	"overview" | "withScheduled" | "draftRows" | "onDraft" | "onAllDrafts" | "onUnfinished" | "onScheduled" | "onRecent"
>

function Work({
	overview,
	withScheduled,
	draftRows,
	onDraft,
	onAllDrafts,
	onUnfinished,
	onScheduled,
	onRecent,
}: WorkProps) {
	switch (overview.kind) {
		case LOAD_STATE.LOADING:
			return (
				<View className="flex-1">
					<OverviewSkeleton withScheduled={withScheduled} />
				</View>
			)
		case LOAD_STATE.READY:
			return (
				<OwnWork
					drafts={overview.drafts}
					draftRows={draftRows}
					unfinished={overview.unfinished}
					scheduled={overview.scheduled}
					recent={overview.recent}
					onDraft={onDraft}
					onAllDrafts={onAllDrafts}
					onUnfinished={onUnfinished}
					onScheduled={onScheduled}
					onRecent={onRecent}
				/>
			)
		case LOAD_STATE.FAILED:
			return <View className="flex-1" />
		default:
			return overview satisfies never
	}
}
