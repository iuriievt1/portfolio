import { DeviceMobileIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
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
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { DEVICE_STATES } from "@/features/devices/constants/device-state"
import { DEVICE_STATE_TONE } from "@/features/devices/constants/device-state-tone"
import { useDevices } from "@/features/devices/hooks/use-devices"
import { DEVICE_STATE_PARAM, deviceStateOf } from "@/features/devices/lib/device-filter"
import { deviceName, deviceSystem } from "@/features/devices/lib/device-label"
import type { Device } from "@/features/devices/types/device.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { formatDateTime } from "@/lib/format"
import { devicePagePath } from "@/lib/routes"
import { DevicesTabs } from "./DevicesTabs"

const texts = cs.devices

const SKELETON_ROWS = 5
const STATE_FIELD_ID = "device-filter-state"
const ANY_STATE = ""

const COLUMNS: ColumnDef<Device>[] = [
	{
		id: "model",
		header: texts.columns.model,
		cell: ({ row }) => <RowLink to={devicePagePath(row.original.id)}>{deviceName(row.original)}</RowLink>,
	},
	{ id: "system", header: texts.columns.system, cell: ({ row }) => deviceSystem(row.original) },
	{
		id: "state",
		header: texts.columns.state,
		cell: ({ row }) => (
			<StatusPill tone={DEVICE_STATE_TONE[row.original.state]}>{texts.state[row.original.state]}</StatusPill>
		),
	},
	{
		id: "last_contact",
		header: texts.columns.lastContact,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) =>
			row.original.last_contact_at === undefined ? (
				<span className="text-muted-foreground">{cs.common.never}</span>
			) : (
				formatDateTime(row.original.last_contact_at)
			),
	},
]

export function DevicesPage() {
	useShellTitle(texts.heading)
	const [searchParams, setSearchParams] = useSearchParams()
	const state = deviceStateOf(searchParams.get(DEVICE_STATE_PARAM))
	const showState = (next: Device["state"] | undefined) =>
		setSearchParams(next === undefined ? {} : { [DEVICE_STATE_PARAM]: next }, { replace: true })
	return (
		<Card className="gap-0 py-0">
			<DevicesTabs />
			<search aria-label={texts.filters.label} className="border-b p-(--card-p)">
				<div className="flex max-w-xs flex-col gap-1.5">
					<Label htmlFor={STATE_FIELD_ID} className="label-caps text-xs text-muted-foreground">
						{texts.filters.state}
					</Label>
					<NativeSelect
						id={STATE_FIELD_ID}
						value={state ?? ANY_STATE}
						onChange={(event) => showState(deviceStateOf(event.target.value))}
					>
						<option value={ANY_STATE}>{texts.filters.any}</option>
						{DEVICE_STATES.map((known) => (
							<option key={known} value={known}>
								{texts.state[known]}
							</option>
						))}
					</NativeSelect>
				</div>
			</search>
			<DevicesList key={state ?? ANY_STATE} state={state} onClearFilter={() => showState(undefined)} />
		</Card>
	)
}

function DevicesList({ state, onClearFilter }: { state: Device["state"] | undefined; onClearFilter: () => void }) {
	const { items: devices, error, loading, hasMore, more, retry } = useDevices(state)

	if (devices.length === 0) {
		if (loading) {
			return <TableSkeleton columns={COLUMNS.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		if (error !== undefined) {
			return <LoadFailure title={errorMessageOf(error)} retryLabel={cs.errors.retry} onRetry={retry} />
		}
		if (state !== undefined) {
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
				icon={<DeviceMobileIcon weight="bold" className="size-5" />}
				title={texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<>
			<DataTable
				columns={COLUMNS}
				data={devices}
				label={texts.tableLabel}
				emptyLabel={texts.empty}
				rowId={(device) => device.id}
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
