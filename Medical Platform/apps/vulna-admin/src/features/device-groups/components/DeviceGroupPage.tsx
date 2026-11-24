import { useState } from "react"
import { useParams } from "react-router"
import { LoadFailure } from "@/components/custom/load-failure"
import { PagePending } from "@/components/custom/page-pending"
import { PageSections } from "@/components/custom/page-section"
import { useConfiguration } from "@/features/configuration/hooks/use-configuration"
import { useDeviceGroup } from "@/features/device-groups/hooks/use-device-groups"
import { installationLoginMethods } from "@/features/login-methods/lib/installation-login-methods"
import cs from "@/i18n/cs.json"
import { useShellTitle } from "@/layouts/shell-title"
import { UnsavedChangesPrompt } from "@/layouts/unsaved-changes-prompt"
import { errorMessageOf } from "@/lib/error-message"
import { requestFailure } from "@/lib/request-failure"
import { deviceGroupsPagePath } from "@/lib/routes"
import { useUnsavedChangesGuard } from "@/lib/use-unsaved-changes-guard"
import { GroupDetailsSection } from "./GroupDetailsSection"
import { GroupLoginMethodsSection } from "./GroupLoginMethodsSection"

const texts = cs.deviceGroups

const GROUPS_CRUMB = { to: deviceGroupsPagePath(), label: texts.heading }

// DESIGN.md 9.3
export function DeviceGroupPage() {
	const { groupId = "" } = useParams()
	const group = useDeviceGroup(groupId)
	const configuration = useConfiguration()
	const [detailsDirty, setDetailsDirty] = useState(false)
	const [methodsDirty, setMethodsDirty] = useState(false)
	const blocker = useUnsavedChangesGuard(detailsDirty || methodsDirty)
	useShellTitle(group.data === undefined ? texts.heading : group.data.name, GROUPS_CRUMB)

	if (group.data === undefined) {
		return (
			<PagePending
				failure={requestFailure(group.error)}
				loadingLabel={cs.common.loading}
				retryLabel={cs.errors.retry}
				onRetry={group.reload}
			/>
		)
	}

	return (
		<PageSections narrow>
			<GroupDetailsSection
				key={`details-${group.data.id}`}
				group={group.data}
				onSaved={group.reload}
				onDirtyChange={setDetailsDirty}
			/>
			{configuration.error === undefined ? null : (
				<LoadFailure
					title={errorMessageOf(configuration.error)}
					retryLabel={cs.errors.retry}
					onRetry={configuration.reload}
				/>
			)}
			<GroupLoginMethodsSection
				key={`methods-${group.data.id}`}
				group={group.data}
				inherited={configuration.data === undefined ? undefined : installationLoginMethods(configuration.data.items)}
				onSaved={group.reload}
				onDirtyChange={setMethodsDirty}
			/>
			<UnsavedChangesPrompt blocker={blocker} />
		</PageSections>
	)
}
