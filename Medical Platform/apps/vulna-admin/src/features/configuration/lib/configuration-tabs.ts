import {
	CONFIGURATION_TAB,
	CONFIGURATION_TABS,
	type ConfigurationSection,
	type ConfigurationTabId,
} from "@/features/configuration/constants/configuration-fields"

interface ConfigurationTabView {
	id: ConfigurationTabId
	sections: readonly ConfigurationSection[]
}

export function tabsOf(sections: readonly ConfigurationSection[]): ConfigurationTabView[] {
	return CONFIGURATION_TABS.map((id) => ({ id, sections: sections.filter((section) => section.tab === id) })).filter(
		(tab) => tab.sections.length > 0,
	)
}

// DESIGN.md 9.1
export function tabFromParam(value: string | null, tabs: readonly ConfigurationTabView[]): ConfigurationTabId {
	return tabs.find((tab) => tab.id === value)?.id ?? tabs[0]?.id ?? CONFIGURATION_TAB.LOGIN
}

function hasAnyKey(tab: ConfigurationTabView, keys: ReadonlySet<string>): boolean {
	return tab.sections.some((section) => section.fields.some((field) => keys.has(field.key)))
}

export function tabsWithKeys(tabs: readonly ConfigurationTabView[], keys: Iterable<string>): Set<ConfigurationTabId> {
	const wanted = new Set(keys)
	return new Set(tabs.filter((tab) => hasAnyKey(tab, wanted)).map((tab) => tab.id))
}

export function firstTabWithKeys(
	tabs: readonly ConfigurationTabView[],
	keys: Iterable<string>,
): ConfigurationTabId | undefined {
	const wanted = new Set(keys)
	return tabs.find((tab) => hasAnyKey(tab, wanted))?.id
}
