import { DELIVERY_STATE } from "@ansora/contracts"
import { CloudArrowUpIcon, MagnifyingGlassIcon, WarningCircleIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useCallback, useMemo } from "react"
import { useSearchParams } from "react-router"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EMPTY_TONE, EmptyState } from "@/components/custom/empty-state"
import { ListFooter } from "@/components/custom/list-footer"
import { RowLink } from "@/components/custom/row-link"
import { StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DELIVERY_STATE_TONE } from "@/features/deliveries/constants/delivery-tone"
import { useDeliveries } from "@/features/deliveries/hooks/use-deliveries"
import {
	deliveryFilterOf,
	EMPTY_DELIVERY_FILTER,
	isFiltered,
	searchParamsOf,
} from "@/features/deliveries/lib/delivery-filter"
import {
	deliveryStateText,
	instanceCountsOf,
	instanceCountText,
	recordText,
} from "@/features/deliveries/lib/delivery-text"
import type { Delivery, DeliveryFilter } from "@/features/deliveries/types/delivery.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { liveRefreshText } from "@/lib/live-refresh"
import { deliveryPagePath } from "@/lib/routes"
import { DeliveryFilters } from "./DeliveryFilters"
import { DeliveryTargetsCard } from "./DeliveryTargetsCard"

const texts = cs.deliveries

const SKELETON_ROWS = 8

// DESIGN.md 9.2, NAB-345
const COLUMNS: ColumnDef<Delivery>[] = [
	{
		id: "acquisition",
		header: texts.columns.acquisition,
		cell: ({ row }) => (
			<RowLink to={deliveryPagePath(row.original.delivery_id)}>
				<span className="whitespace-nowrap">{recordText(row.original)}</span>
			</RowLink>
		),
	},
	{
		id: "target",
		header: texts.columns.target,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => <span className="identifier">{row.original.target}</span>,
	},
	{
		id: "state",
		header: texts.columns.state,
		cell: ({ row }) => (
			<StatusPill tone={DELIVERY_STATE_TONE[row.original.state]}>{deliveryStateText(row.original.state)}</StatusPill>
		),
	},
	{
		id: "instances",
		header: texts.columns.instances,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) => <InstanceCounts delivery={row.original} />,
	},
]

// CAP-028-R12, NAB-345, NAB-534
export function DeliveriesPage() {
	useShellTitle(texts.heading)
	const [searchParams, setSearchParams] = useSearchParams()
	const filter = useMemo(() => deliveryFilterOf(searchParams), [searchParams])

	const applyFilter = useCallback(
		(next: DeliveryFilter) => setSearchParams(searchParamsOf(next), { replace: true }),
		[setSearchParams],
	)

	return (
		<div className="flex flex-col gap-(--section-gap)">
			<DeliveryTargetsCard />
			<Card className="gap-0 py-0">
				<DeliveryFilters filter={filter} onApply={applyFilter} />
				<DeliveriesList filter={filter} onClearFilter={() => applyFilter(EMPTY_DELIVERY_FILTER)} />
			</Card>
		</div>
	)
}

function DeliveriesList({ filter, onClearFilter }: { filter: DeliveryFilter; onClearFilter: () => void }) {
	const { items: deliveries, error, loading, hasMore, more, retry } = useDeliveries(filter)

	if (deliveries.length === 0) {
		if (loading) {
			return <TableSkeleton columns={COLUMNS.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return (
				<EmptyState
					tone={EMPTY_TONE.CRITICAL}
					icon={<WarningCircleIcon weight="fill" className="size-5" />}
					title={errorMessageOf(error)}
					description={liveRefreshText()}
				/>
			)
		}
		if (isFiltered(filter)) {
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
				icon={<CloudArrowUpIcon weight="bold" className="size-5" />}
				title={texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<>
			<DataTable
				columns={COLUMNS}
				data={deliveries}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(delivery) => delivery.delivery_id}
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

function InstanceCounts({ delivery }: { delivery: Delivery }) {
	const counts = instanceCountsOf(delivery)
	if (counts.length === 0) {
		const hasFailed = delivery.state === DELIVERY_STATE.ASSEMBLY_FAILED
		return (
			<span className="text-muted-foreground">{hasFailed ? texts.noInstancesAfterFailure : texts.noInstances}</span>
		)
	}
	return (
		<span className="flex flex-wrap gap-1.5">
			{counts.map((entry) => (
				<StatusPill key={entry.label} tone={entry.tone}>
					{instanceCountText(entry)}
				</StatusPill>
			))}
		</span>
	)
}
