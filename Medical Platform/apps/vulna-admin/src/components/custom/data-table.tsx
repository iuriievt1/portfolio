import { type ColumnDef, flexRender, getCoreRowModel, type RowData, useReactTable } from "@tanstack/react-table"
import { cn } from "cn"
import { TableScroll } from "@/components/custom/table-scroll"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export const HIDE_BELOW = {
	SM: "sm",
	MD: "md",
} as const

type HideBelow = (typeof HIDE_BELOW)[keyof typeof HIDE_BELOW]

declare module "@tanstack/react-table" {
	interface ColumnMeta<TData extends RowData, TValue> {
		hideBelow?: HideBelow
	}
}

const HIDDEN_BELOW: Readonly<Record<HideBelow, string>> = {
	[HIDE_BELOW.SM]: "max-sm:hidden",
	[HIDE_BELOW.MD]: "max-md:hidden",
}

interface Props<T> {
	columns: ColumnDef<T>[]
	data: T[]
	label: string
	emptyLabel: string
	rowId: (row: T) => string
}

// DESIGN.md 8.6
export function DataTable<T>({ columns, data, label, emptyLabel, rowId }: Props<T>) {
	const table = useReactTable({
		columns,
		data,
		getCoreRowModel: getCoreRowModel(),
		getRowId: rowId,
	})
	const rows = table.getRowModel().rows
	return (
		<TableScroll label={label}>
			<Table className="[&_td]:px-(--card-p) [&_th]:px-(--card-p) [&_tr]:hover:bg-muted">
				<TableHeader>
					{table.getHeaderGroups().map((group) => (
						<TableRow key={group.id}>
							{group.headers.map((header) => (
								<TableHead
									key={header.id}
									className={cn(
										"label-caps py-(--row-py) text-xs font-medium text-muted-foreground",
										hiddenClass(header.column.columnDef.meta?.hideBelow),
									)}
								>
									{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{rows.length === 0 ? (
						<TableRow>
							<TableCell colSpan={columns.length} className="py-(--row-py) text-center text-muted-foreground">
								{emptyLabel}
							</TableCell>
						</TableRow>
					) : (
						rows.map((row) => (
							<TableRow key={row.id}>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										className={cn("py-(--row-py)", hiddenClass(cell.column.columnDef.meta?.hideBelow))}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					)}
				</TableBody>
			</Table>
		</TableScroll>
	)
}

function hiddenClass(hideBelow: HideBelow | undefined): string | undefined {
	return hideBelow === undefined ? undefined : HIDDEN_BELOW[hideBelow]
}
