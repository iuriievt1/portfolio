import { ACQUISITION_KIND } from "@ansora/contracts"
import { StatusBar } from "expo-status-bar"
import type { ReactNode } from "react"
import { Image, View } from "react-native"
import type { AcquisitionDetail, AcquisitionDetailFile } from "../../../api/record"
import { isRetryable, type RemoteFailure } from "../../../api/remote-failure"
import { type LocalizedNameOf, useLocalizedName, useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import colors from "../../../styles/colors.json"
import { Button } from "../../../ui/Button"
import { Spinner } from "../../../ui/Spinner"
import { WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { Body, Caption, Heading, TEXT_TONE } from "../../../ui/typography"
import { fillText } from "../../../utils/fill-text"
import { formatDate } from "../../../utils/format-date"
import { CaptureBackAction, CaptureNavBar } from "../../capture/components/CaptureNavBar"
import { PillButton } from "../../capture/components/PillButton"
import { ThumbnailRow } from "../../capture/components/ThumbnailRow"
import { bodySiteDetailOf } from "../../location/body-site-text"
import { remoteFailureTextOf } from "../../remote/remote-failure-text"
import { useFullImage } from "../hooks/use-full-image"
import type { RecordContent } from "../hooks/use-record-detail"
import { FULL_IMAGE, type FullImageState } from "../image-state"
import { fileIdOf, fileTitleOf, orderedFilesOf, recordRegionOf } from "../record-view"
import { ImageThumbnail, PageThumbnail } from "./RemoteThumbnail"
import { StudyLines } from "./StudyLines"

interface Props {
	content: RecordContent
	selectedId: string | undefined
	onSelect: (fileId: string) => void
	onClose: () => void
}

// CAP-020-R09, CAP-020-R15, CAP-020-R22, E124, E125, Figma 07 B.2, Figma 08 A.4
export function RecordViewerScreen({ content, selectedId, onSelect, onClose }: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const { detail } = content
	const files = orderedFilesOf(detail)
	const selectedIndex = Math.max(
		files.findIndex((file) => fileIdOf(file) === selectedId),
		0,
	)
	const selected = files[selectedIndex]
	const image = useFullImage(selected)
	const isPage = detail.kind === ACQUISITION_KIND.SCAN
	const caption = isPage ? undefined : photoCaptionOf(content, nameOf, texts)
	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			<CaptureNavBar
				title={fileTitleOf(detail.kind, selectedIndex, files.length, texts)}
				patient={detail.patient}
				leading={<CaptureBackAction onPress={onClose} />}
			/>
			<View className={`aspect-photo w-full items-center justify-center ${isPage ? "bg-capture-denied-surface" : ""}`}>
				<FullImage state={image.state} detail={detail} isPage={isPage} onRetry={image.retry} />
			</View>
			<View className="flex-1 justify-between pb-safe-gap-or-sheet">
				<View className="gap-2">
					<ThumbnailRow
						items={files.map((file) => ({
							key: fileIdOf(file) ?? String(file.sequence),
							thumbnail: (className: string) => <SeriesTile file={file} className={className} />,
						}))}
						selectedKey={selected === undefined ? undefined : fileIdOf(selected)}
						isInset
						itemLabelOf={(index) => fileTitleOf(detail.kind, index, files.length, texts)}
						onSelect={onSelect}
					/>
					{image.state.kind === FULL_IMAGE.SHOWN && image.state.isViewingCopy ? (
						<ViewingCopyBanner detail={detail} />
					) : null}
					{caption === undefined ? null : (
						<Caption tone={TEXT_TONE.ON_DARK_MUTED} className="px-screen">
							{caption}
						</Caption>
					)}
				</View>
				<View className="px-screen">
					<PillButton label={texts.record.viewer.close} className="px-5" onPress={onClose} />
				</View>
			</View>
		</View>
	)
}

interface PendingProps {
	failure: RemoteFailure | undefined
	onRetry: () => void
	onClose: () => void
}

// CAP-002-R17, CAP-020-R17, E29
export function RecordViewerPending({ failure, onRetry, onClose }: PendingProps) {
	const texts = useTexts()
	return (
		<View className="flex-1 bg-black pt-capture-nav pb-safe-gap-or-sheet android:pt-safe-offset-capture-nav">
			<StatusBar style="light" />
			<View className="flex-1 items-center justify-center">
				{failure === undefined ? (
					<Spinner color={colors["primary-foreground"]} />
				) : (
					<ViewerMessage {...remoteFailureTextOf(failure, texts.record.loadFailed, texts)}>
						{isRetryable(failure) ? <Button label={texts.remote.retry} onPress={onRetry} /> : null}
					</ViewerMessage>
				)}
			</View>
			<View className="px-screen">
				<PillButton label={texts.record.viewer.close} className="px-5" onPress={onClose} />
			</View>
		</View>
	)
}

// CAP-020-R15, CAP-020-S32, CAP-021-R40, E124
function ViewingCopyBanner({ detail }: { detail: AcquisitionDetail }) {
	const texts = useTexts()
	return (
		<View className="gap-1 px-screen">
			<Caption tone={TEXT_TONE.ON_DARK_MUTED}>{texts.record.viewer.viewingCopy}</Caption>
			<StudyLines
				studyInstanceUid={detail.encounter.study_instance_uid}
				accessionNumber={detail.encounter.accession_number}
				tone={TEXT_TONE.ON_DARK_MUTED}
			/>
		</View>
	)
}

interface FullImageProps {
	state: FullImageState
	detail: AcquisitionDetail
	isPage: boolean
	onRetry: () => void
}

// CAP-020-R15, CAP-020-R22, CAP-021-R40, E124, E125
function FullImage({ state, detail, isPage, onRetry }: FullImageProps) {
	const texts = useTexts()
	const viewer = texts.record.viewer
	switch (state.kind) {
		case FULL_IMAGE.LOADING:
			return <Spinner color={colors["primary-foreground"]} />
		case FULL_IMAGE.SHOWN:
			return <Image source={{ uri: state.uri }} className="h-full w-full" resizeMode={WHOLE_PHOTO} />
		case FULL_IMAGE.MISSING:
			return null
		case FULL_IMAGE.GONE:
			return (
				<ViewerMessage
					heading={viewer.originalInPacs.title}
					body={isPage ? viewer.originalInPacs.page : viewer.originalInPacs.photo}
				>
					<StudyLines
						studyInstanceUid={detail.encounter.study_instance_uid}
						accessionNumber={detail.encounter.accession_number}
						tone={TEXT_TONE.ON_DARK_MUTED}
					/>
				</ViewerMessage>
			)
		case FULL_IMAGE.UNAVAILABLE:
			return (
				<ViewerMessage heading={viewer.unavailable.label} body={viewer.unavailable.text}>
					<Button label={viewer.unavailable.retry} onPress={onRetry} />
				</ViewerMessage>
			)
		case FULL_IMAGE.FAILED:
			return (
				<ViewerMessage {...remoteFailureTextOf(state.failure, viewer.failed, texts)}>
					<Button label={texts.remote.retry} onPress={onRetry} />
				</ViewerMessage>
			)
		default:
			return state satisfies never
	}
}

function ViewerMessage({ heading, body, children }: { heading: string; body: string; children: ReactNode }) {
	return (
		<View className="w-full gap-3 px-screen">
			<Heading tone={TEXT_TONE.ON_DARK}>{heading}</Heading>
			<Body tone={TEXT_TONE.ON_DARK_MUTED}>{body}</Body>
			<View className="gap-1 pt-2">{children}</View>
		</View>
	)
}

// Vulna / Capture / Series tile
function SeriesTile({ file, className }: { file: AcquisitionDetailFile; className: string }) {
	if (file.page_id !== null && file.page_id !== undefined) {
		return (
			<View className={`${className} items-center justify-center overflow-hidden bg-capture-tile`}>
				<PageThumbnail
					pageId={file.thumbnail_url === null ? undefined : file.page_id}
					className="h-5/6 aspect-page"
					placeholderClassName="bg-card"
					showsReason={false}
				/>
			</View>
		)
	}
	if (file.image_id === null || file.image_id === undefined || file.thumbnail_url === null) {
		return <View className={`${className} bg-capture-control`} />
	}
	return (
		<ImageThumbnail
			imageId={file.image_id}
			className={className}
			placeholderClassName="bg-capture-control"
			showsReason={false}
		/>
	)
}

// CAP-016-R19, Figma 07 B.2
function photoCaptionOf(content: RecordContent, nameOf: LocalizedNameOf, texts: Texts): string {
	const { detail, codeLists } = content
	const viewer = texts.record.viewer
	const date = formatDate(new Date(detail.closed_at), texts.language)
	if (detail.body_site === undefined) {
		return date
	}
	const detailText = bodySiteDetailOf(detail.body_site, texts)
	const region = recordRegionOf(detail, codeLists, nameOf)
	if (region === undefined) {
		return fillText(viewer.captionWithoutRegion, { date, detail: detailText }, texts.language)
	}
	return fillText(viewer.caption, { date, region, detail: detailText }, texts.language)
}
