import type { PatientDocumentItem } from "../../../api/documents"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { FileTextIcon } from "../../../ui/icons/FileTextIcon"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import type { WithCodeLists } from "../../code-lists/hooks/use-paged-with-code-lists"
import { SectionedList } from "../../history/components/SectionedList"
import { sectionRowsOf } from "../../history/sections"
import { BrowseEmpty, BrowseScreen } from "../../patient/components/BrowseScreen"
import type { PagedContent } from "../../remote/hooks/use-paged-content"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import { documentSectionsOf } from "../document-view"
import { DocumentRow } from "./DocumentRow"

interface Props {
	patient: Patient
	state: LoadState<PagedContent<PatientDocumentItem, WithCodeLists>>
	onBack: () => void
	onRetry: () => void
	onMore: () => void
	onOpen: (document: PatientDocumentItem) => void
}

const EMPTY_ICON = ICON_LOOK_STYLE[ICON_LOOK.FEEDBACK]
// CAP-020-R18, E110, Figma 08 A.1
export function DocumentsScreen({ patient, state, onBack, onRetry, onMore, onOpen }: Props) {
	const texts = useTexts()
	const documents = texts.documents
	return (
		<BrowseScreen
			title={documents.title}
			patient={patient}
			state={state}
			serverErrorHeading={documents.loadFailed}
			onBack={onBack}
			onRetry={onRetry}
		>
			{({ items, codeLists, more }) =>
				items.length === 0 ? (
					<BrowseEmpty
						icon={<FileTextIcon size={EMPTY_ICON.size} color={EMPTY_ICON.color} />}
						heading={documents.empty.heading}
						body={documents.empty.body}
					/>
				) : (
					<SectionedList
						rows={sectionRowsOf(
							documentSectionsOf(items, texts.language),
							(section) => section.key,
							(document: PatientDocumentItem) => document.acquisition_id,
						)}
						more={more}
						onMore={onMore}
						renderItem={(document) => (
							<DocumentRow document={document} codeLists={codeLists} onOpen={() => onOpen(document)} />
						)}
					/>
				)
			}
		</BrowseScreen>
	)
}
