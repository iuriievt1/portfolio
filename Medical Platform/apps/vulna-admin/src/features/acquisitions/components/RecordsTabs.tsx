import { SectionTabs } from "@/components/custom/section-tabs"
import cs from "@/i18n/cs.json"
import { acquisitionsPagePath, draftsPagePath } from "@/lib/routes"

const texts = cs.acquisitions.tabs

const TABS = [
	{ to: acquisitionsPagePath(), label: texts.all },
	{ to: draftsPagePath(), label: texts.drafts },
] as const

export function RecordsTabs() {
	return <SectionTabs label={texts.label} tabs={TABS} />
}
