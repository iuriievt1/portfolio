import { ListBulletsIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { LoadFailure } from "@/components/custom/load-failure"
import { RowLink } from "@/components/custom/row-link"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Card } from "@/components/ui/card"
import { useCodeLists } from "@/features/code-lists/hooks/use-code-lists"
import type { CodeList } from "@/features/code-lists/types/code-list.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { formatCount } from "@/lib/format"
import { codeListPagePath } from "@/lib/routes"
import { TranslationImportDialog } from "./TranslationImportDialog"

const texts = cs.codeLists

const SKELETON_ROWS = 3

const COLUMNS: ColumnDef<CodeList>[] = [
	{
		id: "name",
		header: texts.columns.name,
		cell: ({ row }) => <RowLink to={codeListPagePath(row.original.code)}>{row.original.name}</RowLink>,
	},
	{
		id: "code",
		header: texts.columns.code,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) => <span className="identifier">{row.original.code}</span>,
	},
	{
		id: "items",
		header: texts.columns.items,
		cell: ({ row }) => formatCount(row.original.item_count ?? 0),
	},
]

// CAP-017-R05, CAP-017-R13, NAB-341
export function CodeListsPage() {
	useShellTitle(texts.heading)
	const codeLists = useCodeLists()
	return (
		<Card className="gap-0 py-0">
			<div className="flex justify-end border-b px-(--card-p) py-3">
				<TranslationImportDialog codeListCodes={codeLists.data?.map((codeList) => codeList.code)} />
			</div>
			<CodeListsTable codeLists={codeLists} />
		</Card>
	)
}

function CodeListsTable({ codeLists }: { codeLists: ReturnType<typeof useCodeLists> }) {
	if (codeLists.data === undefined) {
		if (codeLists.error === undefined) {
			return <TableSkeleton columns={COLUMNS.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		return (
			<LoadFailure title={errorMessageOf(codeLists.error)} retryLabel={cs.errors.retry} onRetry={codeLists.reload} />
		)
	}
	if (codeLists.data.length === 0) {
		return (
			<EmptyState
				icon={<ListBulletsIcon weight="bold" className="size-5" />}
				title={texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<DataTable
			columns={COLUMNS}
			data={codeLists.data}
			label={texts.tableLabel}
			emptyLabel={texts.empty}
			rowId={(codeList) => codeList.code}
		/>
	)
}
