import type { BufferedFile } from "@ansora/core-mobile"
import { StatusBar } from "expo-status-bar"
import { View } from "react-native"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { Spinner } from "../../../ui/Spinner"
import { WHOLE_PHOTO } from "../../../ui/ThumbnailImage"
import { Body, TEXT_TONE } from "../../../ui/typography"
import type { CaptureFailure } from "../../capture/capture-failure"
import { CaptureFailureDialog } from "../../capture/components/CaptureFailureDialog"
import { CaptureBackAction, CaptureNavBar } from "../../capture/components/CaptureNavBar"
import { ReviewToolbar } from "../../capture/components/ReviewToolbar"
import { retakeOfFile } from "../../summary/retake"
import { confirmPageRemoval } from "../page-removal"
import { pageTitleOf } from "../page-text"
import { PageImage } from "./PageImage"
import { PageRow } from "./PageRow"

interface Props {
	pages: readonly BufferedFile[]
	selected: BufferedFile
	patient: Patient
	isBusy: boolean
	failure: CaptureFailure | undefined
	onSelect: (fileKey: string) => void
	onRemove: (page: BufferedFile) => void
	onRotate: (page: BufferedFile) => void
	onCrop: (page: BufferedFile) => void
	onRetake: (page: BufferedFile) => void
	onDismissFailure: () => void
	onBack: () => void
	onClose: () => void
}

// CAP-018-R11, CAP-015-R36, CAP-009-S05, Q-076, Figma 06 B.2, B.4, E.2
export function PageReviewScreen({
	pages,
	selected,
	patient,
	isBusy,
	failure,
	onSelect,
	onRemove,
	onRotate,
	onCrop,
	onRetake,
	onDismissFailure,
	onBack,
	onClose,
}: Props) {
	const texts = useTexts()
	const index = pages.findIndex((page) => page.fileKey === selected.fileKey)
	const retake = retakeOfFile(selected)

	return (
		<View className="flex-1 bg-black">
			<StatusBar style="light" />
			<CaptureNavBar
				title={pageTitleOf(index, pages.length, texts)}
				patient={patient}
				leading={<CaptureBackAction onPress={onBack} />}
			/>
			<View className="aspect-photo w-full items-center justify-center p-4">
				<PageImage page={selected} className="h-full w-full" resizeMode={WHOLE_PHOTO} />
				{isBusy ? (
					<View className="absolute">
						<Spinner color={colors["primary-foreground"]} />
					</View>
				) : null}
			</View>
			<View className="flex-1 justify-between pb-safe-gap-or-sheet">
				<PageRow pages={pages} selectedKey={selected.fileKey} onSelect={onSelect} />
				{retake === undefined ? null : (
					<Body tone={TEXT_TONE.ON_DARK} className="px-screen text-center">
						{texts.scan.review.retake[retake]}
					</Body>
				)}
				<ReviewToolbar
					isBusy={isBusy}
					retakeLabel={retake === undefined ? undefined : texts.scan.review.retake.action}
					onDelete={() => confirmPageRemoval(texts, () => onRemove(selected))}
					onRotate={() => onRotate(selected)}
					onCrop={() => onCrop(selected)}
					onRetake={() => onRetake(selected)}
					onClose={onClose}
				/>
			</View>
			<CaptureFailureDialog failure={failure} onDismiss={onDismissFailure} />
		</View>
	)
}
