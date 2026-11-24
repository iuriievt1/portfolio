import { ACQUISITION_KIND, type AcquisitionKind } from "@ansora/contracts"
import { FILE_CONDITION } from "@ansora/core-mobile"
import { useTexts } from "../../../i18n/language-store"
import { ConfirmDialog } from "../../../ui/ConfirmDialog"
import type { ServerFiles } from "../hooks/use-server-files"
import type { RecordFile } from "../shown-file"

interface OpenedProps {
	kind: AcquisitionKind
	files: ServerFiles
}

interface Props {
	kind: AcquisitionKind
	file: RecordFile
	isBusy: boolean
	onRetake: () => void
	onRemove: () => void
	onClose: () => void
}

// CAP-015-R18, CAP-015-R36, CAP-015-S51, CAP-009-S05, E111, E112, Q-076
export function ServerFileDialog({ kind, file, isBusy, onRetake, onRemove, onClose }: Props) {
	const texts = useTexts()
	const closing = texts.capture.closing
	const serverFile = texts.capture.summary.serverFile
	const isScan = kind === ACQUISITION_KIND.SCAN
	const remove = { label: serverFile.remove, onPress: onRemove, disabled: isBusy }
	if (file.condition === FILE_CONDITION.ON_OTHER_DEVICE) {
		return (
			<ConfirmDialog
				title={isScan ? closing.otherDevice.titleScan : closing.otherDevice.title}
				body={isScan ? closing.otherDevice.bodyScan : closing.otherDevice.body}
				destructive={remove}
				secondary={{ label: closing.close, onPress: onClose, disabled: isBusy }}
			/>
		)
	}
	const isRejected = file.condition === FILE_CONDITION.REJECTED
	const title = isRejected ? closing.rejected : closing.unreadable
	const body = isRejected ? serverFile.rejected : serverFile.unreadable
	return (
		<ConfirmDialog
			title={isScan ? title.titleScan : title.title}
			body={isScan ? body.scan : body.photo}
			primary={{
				label: isScan ? texts.scan.review.retake.action : texts.capture.review.retake.action,
				onPress: onRetake,
				disabled: isBusy,
			}}
			destructive={remove}
			secondary={{ label: serverFile.cancel, onPress: onClose, disabled: isBusy }}
		/>
	)
}

// CAP-015-R18, CAP-015-R36, CAP-015-S51, CAP-009-S05, Q-076
export function OpenedServerFile({ kind, files }: OpenedProps) {
	if (files.opened === undefined) {
		return null
	}
	return (
		<ServerFileDialog
			kind={kind}
			file={files.opened}
			isBusy={files.isBusy}
			onRetake={() => void files.retake()}
			onRemove={() => void files.remove()}
			onClose={files.close}
		/>
	)
}
