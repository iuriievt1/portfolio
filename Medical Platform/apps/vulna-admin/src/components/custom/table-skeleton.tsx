import { Skeleton } from "@/components/ui/skeleton"

interface Props {
	columns: number
	rows: number
	label: string
}

// DESIGN.md 9.6
export function TableSkeleton({ columns, rows, label }: Props) {
	const columnKeys = [...Array(columns).keys()]
	return (
		<div role="status" className="flex flex-col">
			<span className="sr-only">{label}</span>
			{[...Array(rows).keys()].map((row) => (
				<div key={row} aria-hidden className="flex gap-(--card-p) border-b px-(--card-p) py-(--row-py) last:border-b-0">
					{columnKeys.map((column) => (
						<Skeleton key={column} className="h-4 flex-1" />
					))}
				</div>
			))}
		</div>
	)
}
