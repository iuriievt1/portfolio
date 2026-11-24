import type { ReactNode } from "react"
import { FlatList, View } from "react-native"
import { InsetDivider } from "../../../ui/Divider"
import { MoreFooter } from "../../remote/components/MoreFooter"
import { MORE_THRESHOLD, type More } from "../../remote/hooks/use-paged-content"
import { SECTION_ROW, type SectionRow } from "../sections"
import { SectionTitle } from "./SectionTitle"

interface Props<T> {
	rows: SectionRow<T>[]
	more: More
	onMore: () => void
	renderItem: (item: T) => ReactNode
}

// E109, E110
export function SectionedList<T>({ rows, more, onMore, renderItem }: Props<T>) {
	return (
		<FlatList
			data={rows}
			keyExtractor={(row) => row.key}
			renderItem={({ item: row }) =>
				row.kind === SECTION_ROW.HEADER ? (
					<SectionTitle title={row.title} isFirst={row.isFirst} />
				) : (
					<View>
						{renderItem(row.item)}
						<InsetDivider />
					</View>
				)
			}
			contentContainerClassName="pt-4 pb-safe-gap-or-sheet"
			onEndReached={onMore}
			onEndReachedThreshold={MORE_THRESHOLD}
			ListFooterComponent={<MoreFooter more={more} onRetry={onMore} />}
		/>
	)
}
