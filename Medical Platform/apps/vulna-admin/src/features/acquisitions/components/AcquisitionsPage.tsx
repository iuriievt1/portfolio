import { ImagesIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useCallback, useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { LoadFailure } from "@/components/custom/load-failure"
import { RowLink } from "@/components/custom/row-link"
import { StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ACQUISITION_STATE_TONE } from "@/features/acquisitions/constants/acquisition-tone"
import { useAcquisitions } from "@/features/acquisitions/hooks/use-acquisitions"
import {
	acquisitionFilterOf,
	EMPTY_ACQUISITION_FILTER,
	isFiltered,
	searchParamsOf,
} from "@/features/acquisitions/lib/acquisition-filter"
import {
	closedAtText,
	fileCountText,
	kindText,
	patientText,
	startedAtText,
	stateText,
} from "@/features/acquisitions/lib/acquisition-text"
import type { AcquisitionFilter, AdministeredAcquisition } from "@/features/acquisitions/types/acquisition.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { acquisitionPagePath } from "@/lib/routes"
import { AcquisitionFilters } from "./AcquisitionFilters"
import { RecordsTabs } from "./RecordsTabs"

const texts = cs.acquisitions

const SKELETON_ROWS = 8

// DESIGN.md 9.2
const COLUMNS: ColumnDef<AdministeredAcquisition>[] = [
	{
		id: "patient",
		header: texts.columns.patient,
		cell: ({ row }) => (
			<RowLink to={acquisitionPagePath(row.original.id)}>
				<span className="identifier">{patientText(row.original)}</span>
			</RowLink>
		),
	},
	{
		id: "kind",
		header: texts.columns.kind,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) => kindText(row.original.kind),
	},
	{
		id: "state",
		header: texts.columns.state,
		cell: ({ row }) => (
			<StatusPill tone={ACQUISITION_STATE_TONE[row.original.state]}>{stateText(row.original.state)}</StatusPill>
		),
	},
	{
		id: "files",
		header: texts.columns.files,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => <span className="num">{fileCountText(row.original)}</span>,
	},
	{
		id: "started_at",
		header: texts.columns.startedAt,
		cell: ({ row }) => <span className="num whitespace-nowrap">{startedAtText(row.original)}</span>,
	},
	{
		id: "closed_at",
		header: texts.columns.closedAt,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => <span className="num whitespace-nowrap">{closedAtText(row.original)}</span>,
	},
]

// CAP-004-R10, CAP-004-S02
export function AcquisitionsPage() {
	useShellTitle(texts.heading)
	const [searchParams, setSearchParams] = useSearchParams()
	// DESIGN.md 9.1
	const [patientIdentifier, setPatientIdentifier] = useState<string | undefined>(undefined)
	const filter = useMemo(() => acquisitionFilterOf(searchParams, patientIdentifier), [searchParams, patientIdentifier])
	const filtered = isFiltered(filter)

	const applyFilter = useCallback(
		(next: AcquisitionFilter) => {
			setPatientIdentifier(next.patientIdentifier)
			setSearchParams(searchParamsOf(next), { replace: true })
		},
		[setSearchParams],
	)

	return (
		<Card className="gap-0 py-0">
			<RecordsTabs />
			<AcquisitionFilters key={JSON.stringify(filter)} filter={filter} filtered={filtered} onApply={applyFilter} />
			<AcquisitionsList
				filter={filter}
				filtered={filtered}
				onClearFilter={() => applyFilter(EMPTY_ACQUISITION_FILTER)}
			/>
		</Card>
	)
}

function AcquisitionsList({
	filter,
	filtered,
	onClearFilter,
}: {
	filter: AcquisitionFilter
	filtered: boolean
	onClearFilter: () => void
}) {
	const { items: acquisitions, error, loading, hasMore, more, retry } = useAcquisitions(filter)

	if (acquisitions.length === 0) {
		if (loading) {
			return <TableSkeleton columns={COLUMNS.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={retry} />
		}
		if (filtered) {
			return (
				<EmptyState
					icon={<MagnifyingGlassIcon weight="bold" className="size-5" />}
					title={texts.emptyFiltered}
					action={
						<Button variant="ghost" size="sm" onClick={onClearFilter}>
							{texts.filters.clear}
						</Button>
					}
				/>
			)
		}
		return (
			<EmptyState
				icon={<ImagesIcon weight="bold" className="size-5" />}
				title={texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<>
			<DataTable
				columns={COLUMNS}
				data={acquisitions}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(acquisition) => acquisition.id}
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
