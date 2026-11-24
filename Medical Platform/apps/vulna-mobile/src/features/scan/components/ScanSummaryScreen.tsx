import { useState } from "react"
import { ScrollView, View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { Divider } from "../../../ui/Divider"
import { Caption, TEXT_TONE } from "../../../ui/typography"
import { countText } from "../../../utils/fill-text"
import type { CaptureSession } from "../../capture/capture-session"
import { StepScreen } from "../../capture/components/StepScreen"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import { ClosingFooter } from "../../summary/components/ClosingFooter"
import { SummarySection } from "../../summary/components/SummarySection"
import { SummarySkeleton } from "../../summary/components/SummarySkeleton"
import type { SummaryClosing } from "../../summary/hooks/use-summary-closing"
import type { SummaryData } from "../../summary/hooks/use-summary-data"
import type { RecordFile } from "../../summary/shown-file"
import { latestDraftOf } from "../../summary/summary-view"
import { visitMomentOf, visitWhenOf } from "../../visit/visit-view"
import { documentTitleTextOf } from "../document-title"
import { PageGrid } from "./PageGrid"

interface Props {
	patient: Patient
	openedAt: Date
	session: CaptureSession
	files: readonly RecordFile[]
	data: LoadState<SummaryData>
	closing: SummaryClosing
	onRetry: () => void
	onBack: () => void
	onOpenTitle: () => void
	onOpenPage: (page: RecordFile) => void
	onAddPage: () => void
	onReorder: (fileKeys: readonly string[]) => void
}

// CAP-018-R11, CAP-018-R14, CAP-018-R15, CAP-014-R14, CAP-015-R35, Figma 06 A.4, B.1, G.1
export function ScanSummaryScreen({ patient, data, closing, onRetry, onBack, ...content }: Props) {
	const texts = useTexts().capture
	return (
		<StepScreen
			title={texts.summary.title}
			patient={patient}
			state={data}
			serverErrorHeading={texts.summary.loadFailed}
			skeleton={<SummarySkeleton />}
			onRetry={onRetry}
			onBack={closing.isClosing ? undefined : onBack}
		>
			{(loaded) => <ScanSummaryContent data={loaded} closing={closing} {...content} />}
		</StepScreen>
	)
}

type ContentProps = Omit<Props, "patient" | "data" | "onRetry" | "onBack"> & { data: SummaryData }

function ScanSummaryContent({
	openedAt,
	session,
	files,
	data,
	closing,
	onOpenTitle,
	onOpenPage,
	onAddPage,
	onReorder,
}: ContentProps) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const draft = latestDraftOf(session.draft, data.draft)
	const visit = visitMomentOf(visitWhenOf(draft.encounter, openedAt, texts.language), texts)
	const title = documentTitleTextOf(draft.document_title, data.codeLists.document_titles, nameOf)
	const [isSorting, setSorting] = useState(false)

	return (
		<>
			<ScrollView
				className={`flex-1 ${closing.isClosing ? "opacity-closing" : ""}`}
				contentContainerClassName="px-screen pt-list"
				showsVerticalScrollIndicator={false}
				scrollEnabled={!isSorting}
				pointerEvents={closing.isClosing ? "none" : "auto"}
			>
				<SummarySection eyebrow={texts.capture.summary.visit} value={visit} />
				<Divider />
				<SummarySection eyebrow={texts.scan.summary.documentTitle} value={title} onOpen={onOpenTitle} />
				<Divider />
				<View className="gap-2 pt-3 pb-3">
					<Caption tone={TEXT_TONE.MUTED}>{countText(texts.files.scan, files.length, texts.language)}</Caption>
					<PageGrid
						pages={files}
						isLocked={closing.isClosing}
						onOpen={onOpenPage}
						onAdd={onAddPage}
						onReorder={onReorder}
						onSortingChange={setSorting}
					/>
				</View>
			</ScrollView>
			<ClosingFooter isClosing={closing.isClosing} onConfirm={closing.onConfirm} />
		</>
	)
}
