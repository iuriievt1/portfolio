import { Pressable, View } from "react-native"
import { useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { PlusIcon } from "../../../ui/icons/PlusIcon"
import { photoLabelOf } from "../../capture/series-text"
import { fileStateLabelOf } from "../retake"
import { isOpenable, type RecordFile } from "../shown-file"
import { FileStateMark } from "./FileStateMark"
import { PhotoFileThumbnail } from "./RecordFileThumbnail"

interface Props {
	files: readonly RecordFile[]
	onOpen: (file: RecordFile) => void
	onAdd: () => void
}

// CAP-015-R33, CAP-015-R35, CAP-015-R36, CAP-009-S05, E111, E112, Q-076
export function PhotoGrid({ files, onOpen, onAdd }: Props) {
	const texts = useTexts()
	return (
		<View className="flex-row flex-wrap gap-3 pt-2">
			{files.map((file, index) => (
				<Pressable
					key={file.fileKey}
					className="h-grid-tile w-grid-tile overflow-hidden rounded-md"
					accessibilityRole="imagebutton"
					accessibilityLabel={photoLabelOf(index, texts)}
					accessibilityHint={fileStateLabelOf(file.condition, texts)}
					disabled={!isOpenable(file)}
					onPress={() => onOpen(file)}
				>
					<PhotoFileThumbnail file={file} className="h-full w-full" />
					<FileStateMark condition={file.condition} />
				</Pressable>
			))}
			<Pressable
				className="h-grid-tile w-grid-tile items-center justify-center rounded-md border-dot border-muted-foreground border-dashed"
				accessibilityRole="button"
				accessibilityLabel={texts.capture.summary.addTile}
				onPress={onAdd}
			>
				<PlusIcon color={colors.primary} />
			</Pressable>
		</View>
	)
}
