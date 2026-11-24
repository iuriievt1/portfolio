import { useState } from "react"
import { useParams } from "react-router"
import { DetailFields } from "@/components/custom/detail-fields"
import { LoadFailure } from "@/components/custom/load-failure"
import { PagePending } from "@/components/custom/page-pending"
import { PageSection, PageSections } from "@/components/custom/page-section"
import { StatusPill } from "@/components/custom/status-pill"
import { useConfiguration } from "@/features/configuration/hooks/use-configuration"
import type { Configuration } from "@/features/configuration/types/configuration.types"
import { useDeviceGroups } from "@/features/device-groups/hooks/use-device-groups"
import type { DeviceGroup } from "@/features/device-groups/types/device-group.types"
import { PENDING_APPROVAL } from "@/features/devices/constants/device-state"
import { DEVICE_STATE_TONE } from "@/features/devices/constants/device-state-tone"
import { useDevice } from "@/features/devices/hooks/use-devices"
import { deviceName, deviceSystem } from "@/features/devices/lib/device-label"
import type { Device } from "@/features/devices/types/device.types"
import { installationLoginMethods } from "@/features/login-methods/lib/installation-login-methods"
import type { EffectiveLoginMethod } from "@/features/login-methods/types/login-methods.types"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { UnsavedChangesPrompt } from "@/layouts/unsaved-changes-prompt"
import { errorMessageOf } from "@/lib/error-message"
import { formatDateTime } from "@/lib/format"
import { requestFailure } from "@/lib/request-failure"
import { devicesPagePath } from "@/lib/routes"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard"
import { ApprovalSection } from "./ApprovalSection"
import { DeviceBlockingSection } from "./DeviceBlockingSection"
import { DeviceGroupSection } from "./DeviceGroupSection"
import { DeviceLoginMethodsSection } from "./DeviceLoginMethodsSection"
import { DeviceQueueSection } from "./DeviceQueueSection"
import { DeviceRevocationSection } from "./DeviceRevocationSection"

const texts = cs.devices

const DEVICES_CRUMB = { to: devicesPagePath(), label: texts.heading }

// DESIGN.md 9.3
export function DevicePage() {
	const { deviceId = "" } = useParams()
	const device = useDevice(deviceId)
	const groups = useDeviceGroups()
	const configuration = useConfiguration()
	const [groupDirty, setGroupDirty] = useState(false)
	const [methodsDirty, setMethodsDirty] = useState(false)
	const blocker = useUnsavedChangesGuard(groupDirty || methodsDirty)
	useShellTitle(device.data === undefined ? texts.heading : deviceName(device.data), DEVICES_CRUMB)

	if (device.data === undefined) {
		return (
			<PagePending
				failure={requestFailure(device.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={device.reload}
			/>
		)
	}

	const settingsFailure = groups.error ?? configuration.error
	const retrySettings = () => {
		groups.reload()
		configuration.reload()
	}

	return (
		<PageSections narrow>
			{device.data.state === PENDING_APPROVAL ? (
				<ApprovalSection device={device.data} onClosed={device.reload} />
			) : null}
			<PageSection title={texts.detail.heading}>
				<DetailFields fields={detailsOf(device.data)} />
			</PageSection>
			<DeviceBlockingSection device={device.data} onClosed={device.reload} />
			<DeviceQueueSection queue={device.data.queue} />
			{settingsFailure === undefined ? null : (
				<LoadFailure title={errorMessageOf(settingsFailure)} retryLabel={cs.errors.retry} onRetry={retrySettings} />
			)}
			{groups.data === undefined ? null : (
				<DeviceGroupSection
					key={`group-${device.data.id}`}
					device={device.data}
					groups={groups.data}
					onSaved={device.reload}
					onDirtyChange={setGroupDirty}
				/>
			)}
			<DeviceLoginMethodsSection
				key={`methods-${device.data.id}`}
				device={device.data}
				inherited={inheritedFor(device.data, groups.data, configuration.data)}
				onSaved={device.reload}
				onDirtyChange={setMethodsDirty}
			/>
			<DeviceRevocationSection device={device.data} onRevoked={device.reload} />
			<UnsavedChangesPrompt blocker={blocker} />
		</PageSections>
	)
}

// CAP-012-R02
function inheritedFor(
	device: Device,
	groups: readonly DeviceGroup[] | undefined,
	configuration: Configuration | undefined,
): readonly EffectiveLoginMethod[] | undefined {
	if (device.group_code === null || device.group_code === undefined) {
		return configuration === undefined ? undefined : installationLoginMethods(configuration.items)
	}
	return groups?.find((group) => group.code === device.group_code)?.effective_login_methods
}

function detailsOf(device: Device) {
	return [
		{ term: texts.columns.system, value: deviceSystem(device) },
		{
			term: texts.columns.state,
			value: <StatusPill tone={DEVICE_STATE_TONE[device.state]}>{texts.state[device.state]}</StatusPill>,
		},
		{
			term: texts.columns.lastContact,
			value: device.last_contact_at === undefined ? cs.common.never : formatDateTime(device.last_contact_at),
		},
		{ term: texts.detail.management, value: managementOf(device) },
		{
			term: texts.detail.hwId,
			value: <span className="identifier break-all">{device.hw_id ?? cs.common.notStated}</span>,
		},
	]
}

function managementOf(device: Device): string {
	if (device.is_mdm_managed === undefined) {
		return cs.common.notStated
	}
	return device.is_mdm_managed ? texts.detail.managed : texts.detail.unmanaged
}
