import { FlatList, View } from "react-native"
import type { Finding } from "../../../api/findings"
import type { Patient } from "../../../api/patients"
import { useTexts } from "../../../i18n/language-store"
import { InsetDivider } from "../../../ui/Divider"
import { BandaidsIcon } from "../../../ui/icons/BandaidsIcon"
import { ICON_LOOK, ICON_LOOK_STYLE } from "../../../ui/icons/icon-look"
import { Detail } from "../../../ui/typography"
import type { WithCodeLists } from "../../code-lists/hooks/use-paged-with-code-lists"
import { BrowseEmpty, BrowseScreen } from "../../patient/components/BrowseScreen"
import { MoreFooter } from "../../remote/components/MoreFooter"
import { MORE, MORE_THRESHOLD, type PagedContent } from "../../remote/hooks/use-paged-content"
import type { LoadState } from "../../remote/hooks/use-remote-content"
import { WoundRow } from "./WoundRow"

interface Props {
	patient: Patient
	state: LoadState<PagedContent<Finding, WithCodeLists>>
	onBack: () => void
	onRetry: () => void
	onMore: () => void
	onOpen: (finding: Finding) => void
}

const EMPTY_ICON_SIZE = ICON_LOOK_STYLE[ICON_LOOK.FEEDBACK].size
// CAP-020-R01, CAP-020-R20, CAP-014-R01, Figma 07 C.1
export function WoundsScreen({ patient, state, onBack, onRetry, onMore, onOpen }: Props) {
	const texts = useTexts().wounds
	return (
		<BrowseScreen
			title={texts.title}
			patient={patient}
			state={state}
			serverErrorHeading={texts.loadFailed}
			onBack={onBack}
			onRetry={onRetry}
		>
			{({ items, codeLists, more }) =>
				items.length === 0 ? (
					<BrowseEmpty
						icon={<BandaidsIcon size={EMPTY_ICON_SIZE} />}
						heading={texts.empty.heading}
						body={texts.empty.body}
					/>
				) : (
					<FlatList
						data={items}
						keyExtractor={(finding) => finding.finding_id}
						renderItem={({ item: finding }) => (
							<View>
								<WoundRow finding={finding} codeLists={codeLists} onOpen={() => onOpen(finding)} />
								<InsetDivider />
							</View>
						)}
						contentContainerClassName="pt-4 pb-safe-gap-or-sheet"
						onEndReached={onMore}
						onEndReachedThreshold={MORE_THRESHOLD}
						ListFooterComponent={
							more === MORE.NONE ? (
								<Detail className="px-screen pt-3">{texts.hint}</Detail>
							) : (
								<MoreFooter more={more} onRetry={onMore} />
							)
						}
					/>
				)
			}
		</BrowseScreen>
	)
}
