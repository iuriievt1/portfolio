import { ScrollView } from "react-native"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { Divider } from "../../../ui/Divider"
import { Body, Detail, TEXT_TONE } from "../../../ui/typography"
import { countText } from "../../../utils/fill-text"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { type CaptureSession, WOUND_CHOICE } from "../../capture/capture-session"
import { StepScreen } from "../../capture/components/StepScreen"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import type { SummaryClosing } from "../hooks/use-summary-closing"
import type { SummaryData } from "../hooks/use-summary-data"
import type { RecordFile } from "../shown-file"
import { latestDraftOf, summaryViewOf } from "../summary-view"
import { ClosingFooter } from "./ClosingFooter"
import { PhotoGrid } from "./PhotoGrid"
import { SummarySection } from "./SummarySection"
import { SummarySkeleton } from "./SummarySkeleton"

const NOTE_PREVIEW_LINES = 3

interface Props {
	patient: Patient
	openedAt: Date
	session: CaptureSession
	files: readonly RecordFile[]
	data: LoadState<SummaryData>
	onRetry: () => void
	onBack: () => void
	onOpenPhoto: (file: RecordFile) => void
	onAddPhoto: () => void
	onOpenAssessment: (() => void) | undefined
	onOpenNote: () => void
	closing: SummaryClosing
}

// CAP-014-R14, CAP-015-R31, CAP-015-R33, CAP-017-R04, CAP-015-R35, Figma 05 H.1
export function SummaryScreen({ patient, data, onRetry, onBack, ...content }: Props) {
	const texts = useTexts().capture
	return (
		<StepScreen
			title={texts.summary.title}
			patient={patient}
			state={data}
			serverErrorHeading={texts.summary.loadFailed}
			skeleton={<SummarySkeleton />}
			onRetry={onRetry}
			onBack={content.closing.isClosing ? undefined : onBack}
		>
			{(loaded) => <SummaryContent data={loaded} {...content} />}
		</StepScreen>
	)
}

type ContentProps = Pick<
	Props,
	"openedAt" | "session" | "files" | "onOpenPhoto" | "onAddPhoto" | "onOpenAssessment" | "onOpenNote" | "closing"
> & {
	data: SummaryData
}

function SummaryContent({
	openedAt,
	session,
	files,
	data,
	onOpenPhoto,
	onAddPhoto,
	onOpenAssessment,
	onOpenNote,
	closing,
}: ContentProps) {
	const texts = useTexts()
	const summary = texts.capture.summary
	const nameOf = useLocalizedName()
	const draft = latestDraftOf(session.draft, data.draft)
	const steps = clinicalSteps()
	const view = summaryViewOf({ draft, codeLists: data.codeLists, openedAt, steps }, nameOf, texts)
	const woundEyebrow = session.wound?.kind === WOUND_CHOICE.EXISTING ? summary.wound : summary.newWound
	const isPhaseMissing = steps.healingPhase && draft.assessment?.healing_phase_code === undefined
	const openNote = isPhaseMissing ? undefined : onOpenNote

	return (
		<>
			<ScrollView
				className={`flex-1 ${closing.isClosing ? "opacity-closing" : ""}`}
				contentContainerClassName="px-screen pt-list"
				showsVerticalScrollIndicator={false}
				pointerEvents={closing.isClosing ? "none" : "auto"}
			>
				<SummarySection eyebrow={summary.visit} value={view.visit} />
				<Divider />
				{view.wound === undefined ? null : (
					<>
						<SummarySection eyebrow={woundEyebrow} value={view.wound.region}>
							<Detail>{view.wound.detail}</Detail>
						</SummarySection>
						<Divider />
					</>
				)}
				<SummarySection eyebrow={countText(texts.files.photo, files.length, texts.language)}>
					<PhotoGrid files={files} onOpen={onOpenPhoto} onAdd={onAddPhoto} />
				</SummarySection>
				<Divider />
				{view.assessment === undefined ? null : (
					<>
						<SummarySection eyebrow={view.assessment.eyebrow} value={view.assessment.value} onOpen={onOpenAssessment} />
						<Divider />
					</>
				)}
				<SummarySection eyebrow={summary.note} onOpen={openNote}>
					{view.note === undefined ? (
						<Body tone={openNote === undefined ? TEXT_TONE.MUTED : TEXT_TONE.ACCENT}>{summary.addNote}</Body>
					) : (
						<Body tone={TEXT_TONE.DEFAULT} numberOfLines={NOTE_PREVIEW_LINES}>
							{view.note}
						</Body>
					)}
				</SummarySection>
				<Divider />
			</ScrollView>
			<ClosingFooter isClosing={closing.isClosing} onConfirm={closing.onConfirm} />
		</>
	)
}
