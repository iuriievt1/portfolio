import type { BufferedFile } from "@ansora/core-mobile"
import { useTexts } from "../../../i18n/language-store"
import { NO_PREVIEWS, NO_SHOTS } from "../../capture/capture-session"
import { ThumbnailRow } from "../../capture/components/ThumbnailRow"
import { RetakeFrame } from "../../summary/components/FileStateMark"
import { retakeOfFile } from "../../summary/retake"
import { pageLabelOf } from "../page-text"
import { PageThumbnail } from "./PageThumbnail"

interface Props {
	pages: readonly BufferedFile[]
	shots?: readonly string[]
	previews?: ReadonlyMap<string, string>
	selectedKey?: string
	hasSlot?: boolean
	onSelect: (fileKey: string) => void
}

// CAP-018-R02, CAP-018-R11, CAP-015-R36, CAP-009-S05, E112, Q-076, Vulna / Capture / Series row
export function PageRow({ pages, shots = NO_SHOTS, previews = NO_PREVIEWS, selectedKey, hasSlot, onSelect }: Props) {
	const texts = useTexts()
	const kept = pages.map((page) => {
		const retake = retakeOfFile(page)
		return {
			key: page.fileKey,
			thumbnail: (className: string) =>
				retake === undefined ? (
					<PageThumbnail page={page} previewUri={previews.get(page.fileKey)} className={className} />
				) : (
					<RetakeFrame retake={retake} className={className}>
						<PageThumbnail page={page} previewUri={undefined} className="h-full w-full rounded-lg" />
					</RetakeFrame>
				),
		}
	})
	const pending = shots.map((fileKey) => ({
		key: fileKey,
		isPending: true,
		thumbnail: (className: string) => (
			<PageThumbnail page={undefined} previewUri={previews.get(fileKey)} className={className} />
		),
	}))
	return (
		<ThumbnailRow
			items={[...kept, ...pending]}
			selectedKey={selectedKey}
			hasSlot={hasSlot}
			isInset
			isFollowingEnd
			label={texts.scan.title}
			slotLabel={texts.scan.addSlot}
			itemLabelOf={(index) => pageLabelOf(index, texts)}
			onSelect={onSelect}
		/>
	)
}
