import { ListMagnifyingGlassIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useMemo } from "react"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { LoadFailure } from "@/components/custom/load-failure"
import { RowButton } from "@/components/custom/row-button"
import { StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Button } from "@/components/ui/button"
import { outcomeTone } from "@/features/audit/constants/audit-tones"
import { useAuditRecords } from "@/features/audit/hooks/use-audit"
import { actorText, eventText, recordOutcomeText } from "@/features/audit/lib/audit-text"
import type { AuditFilter, AuditRecord } from "@/features/audit/types/audit.types"
import cs from "@/i18n/cs.json"
import { errorMessageOf } from "@/lib/error-message"
import { formatPreciseDateTime } from "@/lib/format"

const texts = cs.audit

const SKELETON_ROWS = 8

function auditColumns(onOpen: (record: AuditRecord) => void): ColumnDef<AuditRecord>[] {
	return [
		{
			id: "time",
			header: texts.fields.time,
			cell: ({ row }) => <span className="num whitespace-nowrap">{formatPreciseDateTime(row.original.time)}</span>,
		},
		{
			id: "event",
			header: texts.fields.event,
			cell: ({ row }) => <RowButton onClick={() => onOpen(row.original)}>{eventText(row.original)}</RowButton>,
		},
		{
			id: "actor",
			header: texts.fields.actor,
			meta: { hideBelow: HIDE_BELOW.SM },
			cell: ({ row }) => actorText(row.original),
		},
		{
			id: "outcome",
			header: texts.fields.outcome,
			cell: ({ row }) => (
				<StatusPill tone={outcomeTone(row.original.outcome)}>{recordOutcomeText(row.original)}</StatusPill>
			),
		},
		{
			id: "address",
			header: texts.fields.address,
			meta: { hideBelow: HIDE_BELOW.MD },
			cell: ({ row }) => <span className="identifier">{row.original.source_address ?? ""}</span>,
		},
	]
}

interface Props {
	filter: AuditFilter
	filtered: boolean
	onClearFilter: () => void
	onOpen: (record: AuditRecord) => void
}

// CAP-025-R07
export function AuditRecordsList({ filter, filtered, onClearFilter, onOpen }: Props) {
	const { items: records, error, loading, hasMore, more, retry } = useAuditRecords(filter)
	const columns = useMemo(() => auditColumns(onOpen), [onOpen])

	if (records.length === 0) {
		if (loading) {
			return <TableSkeleton columns={columns.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={retry} />
		}
		if (filtered) {
			return (
				<EmptyState
					icon={<MagnifyingGlassIcon weight="bold" className="size-5" />}
					title={texts.empty}
					description={texts.emptyHint}
					action={
						<Button variant="ghost" size="sm" onClick={onClearFilter}>
							{texts.filters.clear}
						</Button>
					}
				/>
			)
		}
		return <EmptyState icon={<ListMagnifyingGlassIcon weight="bold" className="size-5" />} title={texts.emptyAll} />
	}
	return (
		<>
			<DataTable
				columns={columns}
				data={records}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(record) => record.id}
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
