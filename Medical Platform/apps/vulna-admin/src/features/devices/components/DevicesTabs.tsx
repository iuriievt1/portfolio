import { SectionTabs } from "@/components/custom/section-tabs"
import cs from "@/i18n/cs.json"
import { deviceGroupsPagePath, devicesPagePath } from "@/lib/routes"

const texts = cs.devices.tabs

const TABS = [
	{ to: devicesPagePath(), label: texts.devices },
	{ to: deviceGroupsPagePath(), label: texts.groups },
] as const

export function DevicesTabs() {
	return <SectionTabs label={texts.label} tabs={TABS} />
}
