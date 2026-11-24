import type { BufferedFile } from "@ansora/core-mobile"
import { RetakeFrame } from "../../summary/components/FileStateMark"
import { retakeOfFile } from "../../summary/retake"
import { NO_PREVIEWS, NO_SHOTS } from "../capture-session"
import { PhotoThumbnail } from "./PhotoThumbnail"
import { ThumbnailRow } from "./ThumbnailRow"

interface Props {
	photos: readonly BufferedFile[]
	shots?: readonly string[]
	previews?: ReadonlyMap<string, string>
	selectedKey?: string
	hasSlot?: boolean
	onSelect: (fileKey: string) => void
}

// CAP-015-R10, CAP-015-R32, CAP-015-R33, CAP-009-S05, E112, Q-076, Figma 05 F
export function SeriesRow({ photos, shots = NO_SHOTS, previews = NO_PREVIEWS, selectedKey, hasSlot, onSelect }: Props) {
	const kept = photos.map((photo) => {
		const retake = retakeOfFile(photo)
		return {
			key: photo.fileKey,
			thumbnail: (className: string) =>
				retake === undefined ? (
					<PhotoThumbnail photo={photo} previewUri={previews.get(photo.fileKey)} className={className} />
				) : (
					<RetakeFrame retake={retake} className={className}>
						<PhotoThumbnail photo={photo} className="h-full w-full rounded-lg" />
					</RetakeFrame>
				),
		}
	})
	const pending = shots.map((fileKey) => ({
		key: fileKey,
		isPending: true,
		thumbnail: (className: string) => (
			<PhotoThumbnail photo={undefined} previewUri={previews.get(fileKey)} className={className} />
		),
	}))
	return (
		<ThumbnailRow
			items={[...kept, ...pending]}
			selectedKey={selectedKey}
			hasSlot={hasSlot}
			isInset
			isFollowingEnd
			onSelect={onSelect}
		/>
	)
}
