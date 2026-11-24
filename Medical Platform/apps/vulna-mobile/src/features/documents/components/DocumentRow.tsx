import { View } from "react-native"
import type { CodeListSet } from "../../../api/code-lists"
import type { PatientDocumentItem } from "../../../api/documents"
import { useLocalizedName, useTexts } from "../../../i18n/language-store"
import colors from "../../../styles/colors.json"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import { OpenRow } from "../../../ui/OpenRow"
import { Detail, Label } from "../../../ui/typography"
import { RemoteThumbnail } from "../../record/components/RemoteThumbnail"
import { usePageThumbnail } from "../../record/hooks/use-remote-thumbnail"
import { documentPagesOf, documentTitleOf, documentVisitOf, hasImageData } from "../document-view"

interface Props {
	document: PatientDocumentItem
	codeLists: CodeListSet
	onOpen: () => void
}

const TITLE_LINES = 2
const PAST_RETENTION_ICON_SIZE = ICON_LOOK_STYLE[ICON_LOOK.SECTION].size
const COVER = "h-20 aspect-page overflow-hidden rounded border border-border"

// CAP-020-R18, CAP-020-S17, E30, E110, Vulna / Patient / Document row
export function DocumentRow({ document, codeLists, onOpen }: Props) {
	const texts = useTexts()
	const nameOf = useLocalizedName()
	return (
		<OpenRow onPress={onOpen}>
			<DocumentCover document={document} />
			<View className="flex-1 gap-1">
				<Label numberOfLines={TITLE_LINES}>
					{documentTitleOf(document.document_title, codeLists.document_titles, nameOf, texts)}
				</Label>
				<Detail>{documentVisitOf(document.encounter, texts)}</Detail>
				<Detail>{documentPagesOf(document.page_count, texts)}</Detail>
				{hasImageData(document) ? null : <Detail>{texts.documents.pacsOnly}</Detail>}
			</View>
		</OpenRow>
	)
}

function DocumentCover({ document }: { document: PatientDocumentItem }) {
	const cover = usePageThumbnail(document.cover_page_id ?? undefined)
	if (!hasImageData(document)) {
		return (
			<View className={`${COVER} items-center justify-center bg-secondary`}>
				<FileTextIcon size={PAST_RETENTION_ICON_SIZE} color={colors.foreground} />
			</View>
		)
	}
	return <RemoteThumbnail state={cover} className={COVER} placeholderClassName="bg-card" showsReason={false} />
}
