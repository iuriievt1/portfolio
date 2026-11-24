import { Pressable, View } from "react-native"
import type { CodeListSet } from "../../../api/code-lists"
import type { TimelineItem, WoundTypeChange } from "../../../api/findings"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import type { Texts } from "../../../i18n/texts"
import colors from "../../../styles/colors.json"
import { OpenIcon } from "../../../ui/icons/OpenIcon"
import { RetryIcon } from "../../../ui/icons/RetryIcon"
import { PressedOverlay } from "../../../ui/PressedOverlay"
import { Detail, Label, TEXT_TONE } from "../../../ui/typography"
import { countText, fillText } from "../../../utils/fill-text"
import { formatDate, formatTime } from "../../../utils/format-date"
import { clinicalSteps } from "../../assessment/instance-clinical-steps"
import { ImageThumbnail } from "../../record/components/RemoteThumbnail"
import { StudyLines } from "../../record/components/StudyLines"
import { fileTitleOf } from "../../record/record-view"
import { shownImagesOf } from "../timeline"
import { codeNameOf } from "../wound-view"

const TILES_PER_ROW = 3
// Vulna / Wound / Type change note
const TYPE_CHANGE_ICON_SIZE = 20
const NOTE_PREVIEW_LINES = 2

interface PhotoProps {
	item: TimelineItem
	codeLists: CodeListSet
	onOpenRecord: () => void
	onOpenImage: (imageId: string) => void
}

// CAP-020-R09, CAP-020-R10, CAP-020-R17, CAP-017-R16, Vulna / Wound / Timeline entry
export function TimelinePhotoEntry({ item, codeLists, onOpenRecord, onOpenImage }: PhotoProps) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const images = shownImagesOf(item)
	const phase = clinicalSteps().healingPhase
		? codeNameOf(codeLists.healing_phases, item.assessment?.healing_phase_code, nameOf)
		: undefined
	const note = item.assessment?.description
	return (
		<View className="gap-3 py-3">
			<Pressable
				className="group flex-row items-center gap-3 px-screen"
				accessibilityRole="button"
				onPress={onOpenRecord}
			>
				<PressedOverlay />
				<View className="flex-1 gap-1">
					<Label>{momentTextOf(item.time, texts)}</Label>
					<Detail>{entryLineOf(phase, item.images?.length ?? 0, texts)}</Detail>
					{note === undefined || note === "" ? null : (
						<Detail tone={TEXT_TONE.DEFAULT} numberOfLines={NOTE_PREVIEW_LINES}>
							{note}
						</Detail>
					)}
				</View>
				<OpenIcon />
			</Pressable>
			{images.length === 0 && !item.is_image_data_available ? (
				<View className="gap-1 px-screen">
					<Detail>{texts.record.pacsOnly}</Detail>
					<StudyLines studyInstanceUid={item.study_instance_uid} accessionNumber={item.accession_number} />
				</View>
			) : null}
			{rowsOf(images).map((row) => (
				<View key={row.join()} className="flex-row gap-3 px-screen">
					{row.map((imageId) => (
						<Pressable
							key={imageId}
							className="aspect-square flex-1 overflow-hidden rounded-md"
							accessibilityRole="imagebutton"
							accessibilityLabel={fileTitleOf(item.kind, images.indexOf(imageId), images.length, texts)}
							onPress={() => onOpenImage(imageId)}
						>
							<ImageThumbnail imageId={imageId} className="h-full w-full" placeholderClassName="bg-secondary" />
						</Pressable>
					))}
					{fillersOf(row).map((filler) => (
						<View key={filler} className="flex-1" />
					))}
				</View>
			))}
		</View>
	)
}

interface ChangeProps {
	change: WoundTypeChange
	codeLists: CodeListSet
}

// CAP-020-R19, CAP-020-R21, Vulna / Wound / Type change note
export function TimelineTypeChangeEntry({ change, codeLists }: ChangeProps) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	const detail = texts.wounds.detail
	const typeName = codeNameOf(codeLists.wound_types, change.wound_type_code, nameOf) ?? change.wound_type_code
	const previousName =
		codeNameOf(codeLists.wound_types, change.previous_wound_type_code, nameOf) ?? change.previous_wound_type_code
	return (
		<View className="flex-row items-center gap-3 px-screen py-3">
			<View className="h-11 w-11 items-center justify-center rounded-full bg-secondary">
				<RetryIcon size={TYPE_CHANGE_ICON_SIZE} color={colors.foreground} />
			</View>
			<View className="flex-1 gap-1">
				<Detail tone={TEXT_TONE.DEFAULT}>{fillText(detail.typeChanged, { type: typeName }, texts.language)}</Detail>
				<Detail>
					{fillText(
						detail.typeChangedDetail,
						{ date: formatDate(new Date(change.changed_at), texts.language), previous: previousName },
						texts.language,
					)}
				</Detail>
			</View>
		</View>
	)
}

// CAP-015-R28
function momentTextOf(time: string, texts: Texts): string {
	const moment = new Date(time)
	return fillText(
		texts.wounds.detail.moment,
		{ date: formatDate(moment, texts.language), time: formatTime(moment, texts.language) },
		texts.language,
	)
}

// CAP-017-R03, CAP-015-R28
function entryLineOf(phase: string | undefined, imageCount: number, texts: Texts): string {
	const files = countText(texts.files.photo, imageCount, texts.language)
	return phase === undefined ? files : fillText(texts.wounds.detail.entry, { phase, files }, texts.language)
}

function rowsOf(images: readonly string[]): string[][] {
	const rows: string[][] = []
	for (let start = 0; start < images.length; start += TILES_PER_ROW) {
		rows.push(images.slice(start, start + TILES_PER_ROW))
	}
	return rows
}

function fillersOf(row: readonly string[]): string[] {
	return Array.from({ length: TILES_PER_ROW - row.length }, (_, index) => `filler-${index}`)
}
