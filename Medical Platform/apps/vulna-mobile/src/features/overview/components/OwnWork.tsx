import { useState } from "react"
import { ScrollView, View } from "react-native"
import type { AcquisitionDraftSummary } from "../../../api/acquisitions"
import type { ScheduledEncounterItem, UnfinishedEncounterItem } from "../../../api/encounters"
import type { RecentPatientItem } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { BUTTON_STYLE, Button } from "../../../ui/Button"
import { InsetDivider } from "../../../ui/Divider"
import { FogSpacer } from "../../../ui/Fog"
import { CalendarBlankIcon } from "../../../ui/icons/CalendarBlankIcon"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import { TimeIcon } from "../../../ui/icons/TimeIcon"
import { StateMessage } from "../../../ui/StateMessage"
import { Body } from "../../../ui/typography"
import { patientNumberOf } from "../../patient/patient-identity"
import { useQueuedRecordMarks } from "../../upload/hooks/use-queued-record-marks"
import { recordNoteOf } from "../../upload/record-note"
import { CLINICAL_SECTION, type ClinicalSection, shownItemsOf } from "../clinical-section"
import {
	draftDetailOf,
	recentDetailOf,
	scheduledTimeOf,
	shownDraftsOf,
	unfinishedVisitDetailOf,
	waitingSinceOf,
} from "../overview-rows"
import { SectionHeading } from "./SectionHeading"
import { PlannedRow, PlannedTimeMeasure, WorkRow } from "./WorkRows"

const SECTION_ICON = ICON_LOOK_STYLE[ICON_LOOK.SECTION]
const FEEDBACK_ICON = ICON_LOOK_STYLE[ICON_LOOK.FEEDBACK]

interface Props {
	drafts: readonly AcquisitionDraftSummary[]
	draftRows: number | undefined
	unfinished: ClinicalSection<UnfinishedEncounterItem>
	scheduled: readonly ScheduledEncounterItem[] | undefined
	recent: ClinicalSection<RecentPatientItem> | undefined
	onDraft: (draft: AcquisitionDraftSummary) => void
	onAllDrafts: () => void
	onUnfinished: (item: UnfinishedEncounterItem) => void
	onScheduled: (item: ScheduledEncounterItem) => void
	onRecent: (item: RecentPatientItem) => void
}

// CAP-015-R29, CAP-014-R16, CAP-014-R18, CAP-019-R29, CHG-176, E90, E91, clinical-workflow.yaml listRecentPatients
export function OwnWork({
	drafts,
	draftRows,
	unfinished,
	scheduled,
	recent,
	onDraft,
	onAllDrafts,
	onUnfinished,
	onScheduled,
	onRecent,
}: Props) {
	const texts = useTexts()
	const isStartedShown =
		drafts.length > 0 || shownItemsOf(unfinished).length > 0 || unfinished.kind === CLINICAL_SECTION.UNAVAILABLE
	const hasPlan = scheduled !== undefined && scheduled.length > 0
	const hasRecent = shownItemsOf(recent).length > 0
	return (
		<ScrollView contentContainerClassName="grow pt-4">
			{isStartedShown ? (
				<Started
					drafts={drafts}
					draftRows={draftRows}
					unfinished={unfinished}
					onDraft={onDraft}
					onAllDrafts={onAllDrafts}
					onUnfinished={onUnfinished}
				/>
			) : null}
			{scheduled === undefined ? null : (
				<Scheduled items={scheduled} isFirst={!isStartedShown} onScheduled={onScheduled} />
			)}
			{recent === undefined ? null : <Recent recent={recent} isFirst={!isStartedShown} onRecent={onRecent} />}
			{isStartedShown || hasPlan || hasRecent ? null : (
				<View className="flex-1 justify-center px-screen">
					<StateMessage
						icon={<FileTextIcon {...FEEDBACK_ICON} />}
						heading={texts.overview.nothingStarted.heading}
						body={texts.overview.nothingStarted.body}
					/>
				</View>
			)}
			<FogSpacer />
		</ScrollView>
	)
}

type StartedProps = Pick<Props, "drafts" | "draftRows" | "unfinished" | "onDraft" | "onAllDrafts" | "onUnfinished">

// CAP-015-R29, CAP-014-R18, CAP-014-R20, E91, clinical-workflow.yaml listUnfinishedEncounters
function Started({ drafts, draftRows, unfinished, onDraft, onAllDrafts, onUnfinished }: StartedProps) {
	const texts = useTexts()
	const marks = useQueuedRecordMarks()
	const now = new Date()
	const shown = shownDraftsOf(drafts, draftRows)
	const visits = shownItemsOf(unfinished)
	return (
		<>
			<SectionHeading
				icon={<FileTextIcon {...SECTION_ICON} />}
				title={texts.overview.started}
				value={String(drafts.length + visits.length)}
			/>
			<View className="pt-2">
				{shown.rows.map((draft) => (
					<View key={draft.acquisition_id}>
						<WorkRow
							patient={patientNumberOf(draft.patient)}
							detail={draftDetailOf(draft, now, texts, recordNoteOf(draft, marks))}
							waitingSince={waitingSinceOf(draft, texts)}
							onPress={() => onDraft(draft)}
						/>
						<InsetDivider />
					</View>
				))}
				{visits.map((visit) => (
					<View key={visit.encounter.encounter_id}>
						<WorkRow
							patient={patientNumberOf(visit.patient)}
							detail={unfinishedVisitDetailOf(visit, now, texts)}
							onPress={() => onUnfinished(visit)}
						/>
						<InsetDivider />
					</View>
				))}
			</View>
			{unfinished.kind === CLINICAL_SECTION.UNAVAILABLE ? (
				<Body className="px-screen pt-2">{texts.remote.documentationUnavailable.body}</Body>
			) : null}
			{shown.hasMore ? (
				<View className="px-screen pt-2">
					<Button label={texts.overview.allDrafts} style={BUTTON_STYLE.PLAIN} onPress={onAllDrafts} />
				</View>
			) : null}
		</>
	)
}

interface ScheduledProps {
	items: readonly ScheduledEncounterItem[]
	isFirst: boolean
	onScheduled: (item: ScheduledEncounterItem) => void
}

function Scheduled({ items, isFirst, onScheduled }: ScheduledProps) {
	const texts = useTexts()
	const [timeWidth, setTimeWidth] = useState<number | undefined>(undefined)
	const rows = items.map((item) => ({ item, time: scheduledTimeOf(item.encounter, texts) }))
	const knownTimes = [...new Set(rows.filter(({ time }) => time.isKnown).map(({ time }) => time.text))]
	return (
		<View className={isFirst ? "pt-4" : "pt-8"}>
			<SectionHeading
				icon={<CalendarBlankIcon {...SECTION_ICON} />}
				title={texts.overview.planned}
				value={texts.overview.today}
			/>
			{items.length === 0 ? (
				<Body className="px-screen pt-2">{texts.overview.noScheduled}</Body>
			) : (
				<View className="pt-2">
					<PlannedTimeMeasure times={knownTimes} onWidth={setTimeWidth} />
					{rows.map(({ item, time }) => (
						<View key={item.encounter.encounter_id}>
							<PlannedRow
								time={time}
								timeWidth={timeWidth}
								patient={patientNumberOf(item.patient)}
								onPress={() => onScheduled(item)}
							/>
							<InsetDivider />
						</View>
					))}
				</View>
			)}
		</View>
	)
}

interface RecentListProps {
	recent: ClinicalSection<RecentPatientItem>
	isFirst: boolean
	onRecent: (item: RecentPatientItem) => void
}

// clinical-workflow.yaml listRecentPatients, CAP-013-R19, CAP-020-R16, E129
function Recent({ recent, isFirst, onRecent }: RecentListProps) {
	const texts = useTexts()
	if (recent.kind === CLINICAL_SECTION.SHOWN && recent.items.length === 0) {
		return null
	}
	return (
		<View className={isFirst ? "pt-4" : "pt-8"}>
			<SectionHeading icon={<TimeIcon {...SECTION_ICON} />} title={texts.overview.recent} />
			<RecentContent recent={recent} onRecent={onRecent} />
		</View>
	)
}

function RecentContent({ recent, onRecent }: Omit<RecentListProps, "isFirst">) {
	const texts = useTexts()
	const now = new Date()
	switch (recent.kind) {
		case CLINICAL_SECTION.UNAVAILABLE:
			return <Body className="px-screen pt-2">{texts.remote.documentationUnavailable.body}</Body>
		case CLINICAL_SECTION.SHOWN:
			return (
				<View className="pt-2">
					{recent.items.map((item) => (
						<View key={item.patient.patient_id}>
							<WorkRow
								patient={patientNumberOf(item.patient)}
								detail={recentDetailOf(item, now, texts)}
								onPress={() => onRecent(item)}
							/>
							<InsetDivider />
						</View>
					))}
				</View>
			)
		default:
			return recent satisfies never
	}
}
