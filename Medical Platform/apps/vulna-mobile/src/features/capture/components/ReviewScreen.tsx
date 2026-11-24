import type { BufferedFile } from "@ansora/core-mobile"
import { StatusBar } from "expo-status-bar"
import { useState } from "react"
import { View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import { Spinner } from "../../../ui/Spinner"
import { WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { Body, TEXT_TONE } from "../../../ui/typography"
import { retakeOfFile } from "../../summary/retake"
import type { CaptureFailure } from "../capture-failure"
import { seriesTitleOf } from "../series-text"
import { CaptureFailureDialog } from "./CaptureFailureDialog"
import { CaptureBackAction, CaptureNavBar } from "./CaptureNavBar"
import { PhotoThumbnail } from "./PhotoThumbnail"
import { ReviewToolbar } from "./ReviewToolbar"
import { SeriesRow } from "./SeriesRow"

interface Props {
	photos: readonly BufferedFile[]
	selected: BufferedFile
	patient: Patient
	isBusy: boolean
	failure: CaptureFailure | undefined
	onSelect: (fileKey: string) => void
	onDelete: (photo: BufferedFile) => void
	onRotate: (photo: BufferedFile) => void
	onCrop: (photo: BufferedFile) => void
	onRetake: (photo: BufferedFile) => void
	onDismissFailure: () => void
	onBack: () => void
	onClose: () => void
}

// CAP-015-R32, CAP-015-R34, CAP-015-R18, CAP-015-S12, CAP-015-S13, CAP-015-R36, CAP-009-S05, Q-076
export function ReviewScreen({
	photos,
	selected,
	patient,
	isBusy,
	failure,
	onSelect,
	onDelete,
	onRotate,
	onCrop,
	onRetake,
	onDismissFailure,
	onBack,
	onClose,
}: Props) {
	const texts = useTexts()
	const review = texts.capture.review
	const [isConfirmingDelete, setConfirmingDelete] = useState(false)
	const index = photos.findIndex((photo) => photo.fileKey === selected.fileKey)
	const retake = retakeOfFile(selected)

	const confirmDelete = () => {
		setConfirmingDelete(false)
		onDelete(selected)
	}

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			<CaptureNavBar
				title={seriesTitleOf(index, photos.length, texts)}
				patient={patient}
				leading={<CaptureBackAction onPress={onBack} />}
			/>
			<View className="aspect-photo w-full items-center justify-center">
				<PhotoThumbnail photo={selected} className="h-full w-full" resizeMode={WHOLE_PHOTO} />
				{isBusy ? (
					<View className="absolute">
						<Spinner color={colors["primary-foreground"]} />
					</View>
				) : null}
			</View>
			<View className="flex-1 justify-between pb-safe-gap-or-sheet">
				<SeriesRow photos={photos} selectedKey={selected.fileKey} onSelect={onSelect} />
				{retake === undefined ? null : (
					<Body tone={TEXT_TONE.ON_DARK} className="px-screen text-center">
						{review.retake[retake]}
					</Body>
				)}
				<ReviewToolbar
					isBusy={isBusy}
					retakeLabel={retake === undefined ? undefined : review.retake.action}
					onDelete={() => setConfirmingDelete(true)}
					onRotate={() => onRotate(selected)}
					onCrop={() => onCrop(selected)}
					onRetake={() => onRetake(selected)}
					onClose={onClose}
				/>
			</View>
			{isConfirmingDelete ? (
				<ConfirmDialog
					title={review.confirmDelete.title}
					body={review.confirmDelete.body}
					destructive={{ label: review.confirmDelete.confirm, onPress: confirmDelete }}
					secondary={{ label: review.confirmDelete.cancel, onPress: () => setConfirmingDelete(false) }}
				/>
			) : null}
			<CaptureFailureDialog failure={failure} onDismiss={onDismissFailure} />
		</View>
	)
}
