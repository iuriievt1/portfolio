import { ACQUISITION_KIND } from "@ansora/contracts"
import { Pressable, ScrollView, View } from "react-native"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import { Divider } from "../../../ui/Divider"
import { Body, Caption, Detail, Heading, Label, TEXT_TONE } from "../../../ui/typography"
import { countText } from "../../../utils/fill-text"
import { assessmentEyebrowOf } from "../../assessment/clinical-steps"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { documentPagesOf } from "../../documents/document-view"
import { bodySiteDetailOf } from "../../location/body-site-text"
import { BrowseScreen } from "../../patient/components/BrowseScreen"
import { LOAD_STATE, type LoadState } from "../../remote/hooks/use-remote-content"
import { visitMomentOf, visitTitleOf, visitWhenOf } from "../../visit/visit-view"
import type { RecordContent } from "../hooks/use-record-detail"
import {
	closedAtOf,
	fileIdOf,
	fileTitleOf,
	isPastPreviewRetention,
	orderedFilesOf,
	pageCaptionOf,
	recordAssessmentOf,
	recordDocumentNameOf,
	recordRegionOf,
	recordTitleOf,
} from "../record-view"
import { RecordSection } from "./RecordSection"
import { ImageThumbnail, PageThumbnail } from "./RemoteThumbnail"
import { StudyLines } from "./StudyLines"

interface Props {
	state: LoadState<RecordContent>
	onBack: () => void
	onRetry: () => void
	onOpenFile: (fileId: string) => void
}

// CAP-020-R17, CAP-019-R28, E108, Figma 07 B.1, Figma 08 A.2
export function RecordDetailScreen({ state, onBack, onRetry, onOpenFile }: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const loaded = state.kind === LOAD_STATE.READY ? state : undefined
	const title = loaded === undefined ? "" : recordTitleOf(loaded.detail, loaded.codeLists, nameOf, texts)
	return (
		<BrowseScreen
			title={title}
			patient={loaded?.detail.patient}
			state={state}
			serverErrorHeading={texts.record.loadFailed}
			onBack={onBack}
			onRetry={onRetry}
		>
			{(content) =>
				content.detail.kind === ACQUISITION_KIND.SCAN ? (
					<DocumentRecord content={content} onOpenFile={onOpenFile} />
				) : (
					<WoundRecord content={content} onOpenFile={onOpenFile} />
				)
			}
		</BrowseScreen>
	)
}

interface ContentProps {
	content: RecordContent
	onOpenFile: (fileId: string) => void
}

// CAP-020-R17, CAP-015-R33, CAP-017-R16, E108, Figma 07 B.1
function WoundRecord({ content, onOpenFile }: ContentProps) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const { detail, codeLists } = content
	const record = texts.record
	const files = orderedFilesOf(detail)
	const when = visitWhenOf(detail.encounter, new Date(detail.closed_at), texts.language)
	const steps = clinicalSteps()
	const assessment = recordAssessmentOf(detail, codeLists, nameOf, steps, texts)
	const assessmentEyebrow = assessmentEyebrowOf(steps, record.typeAndPhase, texts)
	const note = detail.assessment?.description
	return (
		<ScrollView contentContainerClassName="px-screen pt-2 pb-safe-gap-or-sheet">
			<RecordSection eyebrow={record.visit} value={visitMomentOf(when, texts)} detail={closedAtOf(detail, texts)} />
			<Divider />
			{detail.body_site === undefined ? null : (
				<>
					<RecordSection
						eyebrow={record.wound}
						value={recordRegionOf(detail, codeLists, nameOf) ?? texts.wounds.unknownPlace}
						detail={bodySiteDetailOf(detail.body_site, texts)}
					/>
					<Divider />
				</>
			)}
			<View className="gap-2 py-3">
				<Caption tone={TEXT_TONE.MUTED}>{countText(texts.files.photo, files.length, texts.language)}</Caption>
				<View className="flex-row flex-wrap gap-x-3 gap-y-4">
					{files.map((file, index) => {
						const fileId = fileIdOf(file)
						return (
							<Pressable
								key={file.sequence}
								className="h-grid-tile w-grid-tile overflow-hidden rounded-md"
								accessibilityRole="imagebutton"
								accessibilityLabel={fileTitleOf(detail.kind, index, files.length, texts)}
								disabled={fileId === undefined}
								onPress={() => (fileId === undefined ? undefined : onOpenFile(fileId))}
							>
								{file.thumbnail_url === null || file.image_id === null || file.image_id === undefined ? (
									<View className="h-full w-full bg-secondary" />
								) : (
									<ImageThumbnail
										imageId={file.image_id}
										className="h-full w-full"
										placeholderClassName="bg-secondary"
									/>
								)}
							</Pressable>
						)
					})}
				</View>
				<PacsOnly content={content} />
			</View>
			<Divider />
			{assessment === undefined || assessmentEyebrow === undefined ? null : (
				<>
					<RecordSection eyebrow={assessmentEyebrow} value={assessment} />
					<Divider />
				</>
			)}
			{note === undefined || note === "" ? null : (
				<>
					<RecordSection eyebrow={record.note} value={note} />
					<Divider />
				</>
			)}
		</ScrollView>
	)
}

// CAP-020-R17, CAP-018-R11, E108, Figma 08 A.2, Figma 08 A.3
function DocumentRecord({ content, onOpenFile }: ContentProps) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const { detail, codeLists } = content
	const pages = orderedFilesOf(detail)
	const when = visitWhenOf(detail.encounter, new Date(detail.closed_at), texts.language)
	return (
		<ScrollView contentContainerClassName="gap-4 pt-6 pb-safe-gap-or-sheet">
			<View className="gap-1 px-screen">
				<Heading>{recordDocumentNameOf(detail, codeLists, nameOf, texts)}</Heading>
				<Body>{visitTitleOf(when, texts)}</Body>
				<Detail>{documentPagesOf(pages.length, texts)}</Detail>
				<PacsOnly content={content} />
			</View>
			<View className="gap-4 px-screen pt-4">
				<Label tone={TEXT_TONE.MUTED} accessibilityRole="header">
					{texts.record.pages}
				</Label>
				{pages.map((page, index) => {
					const pageId = page.page_id ?? undefined
					return (
						<Pressable
							key={page.sequence}
							className="gap-2"
							accessibilityRole="imagebutton"
							accessibilityLabel={fileTitleOf(detail.kind, index, pages.length, texts)}
							disabled={pageId === undefined}
							onPress={() => (pageId === undefined ? undefined : onOpenFile(pageId))}
						>
							<PageThumbnail
								pageId={page.thumbnail_url === null ? undefined : pageId}
								className="aspect-page w-full overflow-hidden rounded border border-border"
								placeholderClassName="bg-card"
							/>
							<Caption className="text-center font-normal" tone={TEXT_TONE.MUTED}>
								{pageCaptionOf(index, pages.length, texts)}
							</Caption>
						</Pressable>
					)
				})}
			</View>
		</ScrollView>
	)
}

// CAP-020-R07, CAP-020-S13, CAP-020-S17, E30
function PacsOnly({ content }: { content: RecordContent }) {
	const texts = useTexts()
	const { detail } = content
	if (!isPastPreviewRetention(detail)) {
		return null
	}
	return (
		<View className="gap-1 pt-2">
			<Detail>{texts.record.pacsOnly}</Detail>
			<StudyLines
				studyInstanceUid={detail.encounter.study_instance_uid}
				accessionNumber={detail.encounter.accession_number}
			/>
		</View>
	)
}
