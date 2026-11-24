import { SHOWN_FILE } from "@ansora/core-mobile"
import { View } from "react-native"
import type { AcquisitionDraftFile } from "../../../api/acquisition-files"
import { PhotoThumbnail } from "../../capture/components/PhotoThumbnail"
import { ImageThumbnail, PageThumbnail } from "../../record/components/RemoteThumbnail"
import { PageImage } from "../../scan/components/PageImage"
import type { RecordFile } from "../shown-file"

interface Props {
	file: RecordFile
	className: string
}

// ADR-026
function hasThumbnail(file: Pick<AcquisitionDraftFile, "thumbnail_url">): boolean {
	return (file.thumbnail_url ?? null) !== null
}

// ADR-026, CAP-015-R35, CAP-018-R14, CAP-020-R17
export function PhotoFileThumbnail({ file, className }: Props) {
	if (file.kind === SHOWN_FILE.LOCAL) {
		return <PhotoThumbnail photo={file.local} className={className} />
	}
	const imageId = file.server.image_id ?? undefined
	if (!hasThumbnail(file.server) || imageId === undefined) {
		return <View className={`${className} bg-capture-control`} />
	}
	return (
		<ImageThumbnail
			imageId={imageId}
			className={className}
			placeholderClassName="bg-capture-control"
			showsReason={false}
		/>
	)
}

// ADR-026, CAP-018-R14, CAP-020-R17
export function PageFileThumbnail({ file, className }: Props) {
	if (file.kind === SHOWN_FILE.LOCAL) {
		return <PageImage page={file.local} className={className} />
	}
	const pageId = hasThumbnail(file.server) ? (file.server.page_id ?? undefined) : undefined
	return <PageThumbnail pageId={pageId} className={className} placeholderClassName="bg-card" showsReason={false} />
}
