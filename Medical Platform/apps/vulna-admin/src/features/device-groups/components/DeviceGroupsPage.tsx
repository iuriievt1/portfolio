import { SquaresFourIcon } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { useNavigate } from "react-router"
import { DataTable, HIDE_BELOW } from "@/components/custom/data-table"
import { EmptyState } from "@/components/custom/empty-state"
import { LoadFailure } from "@/components/custom/load-failure"
import { RowLink } from "@/components/custom/row-link"
import { PILL_TONE, StatusPill } from "@/components/custom/status-pill"
import { TableSkeleton } from "@/components/custom/table-skeleton"
import { Card } from "@/components/ui/card"
import { useDeviceGroups } from "@/features/device-groups/hooks/use-device-groups"
import type { DeviceGroup } from "@/features/device-groups/types/device-group.types"
import { DevicesTabs } from "@/features/devices/components/DevicesTabs"
import { enabledQuickMethods, hasQuickLoginMethod } from "@/features/login-methods/lib/login-method-choices"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { errorMessageOf } from "@/lib/error-message"
import { formatCount, formatList } from "@/lib/format"
import { deviceGroupPagePath } from "@/lib/routes"
import { NewDeviceGroupDialog } from "./NewDeviceGroupDialog"

const texts = cs.deviceGroups

const SKELETON_ROWS = 3

const COLUMNS: ColumnDef<DeviceGroup>[] = [
	{
		id: "name",
		header: texts.columns.name,
		cell: ({ row }) => <RowLink to={deviceGroupPagePath(row.original.id)}>{row.original.name}</RowLink>,
	},
	{
		id: "code",
		header: texts.columns.code,
		meta: { hideBelow: HIDE_BELOW.SM },
		cell: ({ row }) => <span className="identifier">{row.original.code}</span>,
	},
	{
		id: "devices",
		header: texts.columns.devices,
		cell: ({ row }) => formatCount(row.original.device_count ?? 0),
	},
	{
		id: "methods",
		header: texts.columns.methods,
		meta: { hideBelow: HIDE_BELOW.MD },
		cell: ({ row }) => <QuickMethods group={row.original} />,
	},
]

// CAP-006-R18, CAP-012-R32
export function DeviceGroupsPage() {
	useShellTitle(cs.devices.heading)
	const navigate = useNavigate()
	return (
		<Card className="gap-0 py-0">
			<DevicesTabs />
			<div className="flex justify-end border-b px-(--card-p) py-3">
				<NewDeviceGroupDialog onCreated={(group) => navigate(deviceGroupPagePath(group.id))} />
			</div>
			<DeviceGroupsList />
		</Card>
	)
}

function DeviceGroupsList() {
	const groups = useDeviceGroups()

	if (groups.data === undefined) {
		if (groups.error === undefined) {
			return <TableSkeleton columns={COLUMNS.length} rows={SKELETON_ROWS} label={cs.common.loading} />
		}
		return <LoadFailure title={errorMessageOf(groups.error)} retryLabel={cs.errors.retry} onRetry={groups.reload} />
	}
	if (groups.data.length === 0) {
		return (
			<EmptyState
				icon={<SquaresFourIcon weight="bold" className="size-5" />}
				title={texts.empty}
				description={texts.emptyHint}
			/>
		)
	}
	return (
		<DataTable
			columns={COLUMNS}
			data={groups.data}
			label={texts.tableLabel}
			emptyLabel={texts.empty}
			rowId={(group) => group.id}
		/>
	)
}

function QuickMethods({ group }: { group: DeviceGroup }) {
	if (!hasQuickLoginMethod(group.effective_login_methods)) {
		return <StatusPill tone={PILL_TONE.WARN}>{texts.onlyAccount}</StatusPill>
	}
	return formatList(enabledQuickMethods(group.effective_login_methods).map((method) => cs.loginMethods.method[method]))
}
