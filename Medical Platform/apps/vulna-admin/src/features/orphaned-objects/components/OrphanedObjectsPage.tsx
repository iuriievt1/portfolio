import { FileXIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { LoadFailure } from "@/components/custom/load-failure"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Card } from "@/components/ui/card"
import { OrphanedObjectDeletionAction } from "@/features/orphaned-objects/components/OrphanedObjectDeletionAction"
import { useOrphanedObjects } from "@/features/orphaned-objects/hooks/use-orphaned-objects"
import { shortObjectIdOf } from "@/features/orphaned-objects/lib/orphaned-object-view"
import type { OrphanedObject } from "@/features/orphaned-objects/types/orphaned-object.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { fillText, formatBytes, formatDateTime } from "@/lib/format"
import { alertsPagePath } from "@/lib/routes"

const texts = cs.orphanedObjects

const ALERTS_CRUMB = { to: alertsPagePath(), label: cs.alerts.heading }
const SKELETON_ROWS = 3

const COLUMNS: ColumnDef<OrphanedObject>[] = [
	{
		id: "object",
		header: texts.columns.object,
		cell: ({ row }) => (
			<span className="identifier" title={row.original.id}>
				{shortObjectIdOf(row.original.id)}
			</span>
		),
	},
	{
		id: "size",
		header: texts.columns.size,
		cell: ({ row }) => <span className="num">{formatBytes(row.original.size_bytes)}</span>,
	},
	{
		id: "created_at",
		header: texts.columns.createdAt,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) => formatDateTime(row.original.created_at),
	},
	{
		id: "set_aside_at",
		header: texts.columns.setAsideAt,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => formatDateTime(row.original.set_aside_at),
	},
]

// CAP-026-S08
function deletionColumn(onDeleted: (objectId: string) => void): ColumnDef<OrphanedObject> {
	return {
		id: "actions",
		header: () => <span className="sr-only">{texts.columns.actions}</span>,
		cell: ({ row }) => <OrphanedObjectDeletionAction objectId={row.original.id} onDeleted={onDeleted} />,
	}
}

// CAP-026-R14, CAP-026-S07, CAP-026-S08, stavy-a-mikrocopy.md E67, ADR-038
export function OrphanedObjectsPage() {
	useShellTitle(texts.heading, ALERTS_CRUMB)
	const [generation, setGeneration] = useState(0)
	const [deletedId, setDeletedId] = useState<string | undefined>(undefined)

	const showDeleted = (objectId: string) => {
		setDeletedId(objectId)
		setGeneration((current) => current + 1)
	}

	return (
		<Card className="gap-0 py-0">
			<div className="flex flex-col gap-2 border-b p-(--card-p)">
				<p className="max-w-prose text-sm text-muted-foreground">{texts.intro}</p>
				{deletedId === undefined ? null : (
					<p role="status" className="text-sm text-muted-foreground">
						{fillText(texts.deleted, { id: shortObjectIdOf(deletedId) })}
					</p>
				)}
			</div>
			<OrphanedObjectsList key={generation} onDeleted={showDeleted} />
		</Card>
	)
}

function OrphanedObjectsList({ onDeleted }: { onDeleted: (objectId: string) => void }) {
	const { items: objects, error, loading, hasMore, more, retry } = useOrphanedObjects()
	const columns = useMemo(() => [...COLUMNS, deletionColumn(onDeleted)], [onDeleted])

	if (objects.length === 0) {
		if (loading) {
			return <TableSkeleton columns={columns.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={retry} />
		}
		return (
			<EmptyState
				icon={<FileXIcon weight="bold" className="size-5" />}
				title={texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<>
			<DataTable
				columns={columns}
				data={objects}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(object) => object.id}
			/>
			<ListFooter
				errorMessage={error === undefined ? undefined : errorMessageOf(error)}
				hasMore={hasMore}
				loading={loading}
				moreLabel={cs.common.more}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onMore={more}
				onRetry={retry}
			/>
		</>
	)
}
