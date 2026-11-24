import { CONFIGURATION_KEY } from "@ansora/contracts"
import { describe, expect, it } from "vitest"
import {
	CONFIGURATION_SECTIONS,
	CONFIGURATION_TAB,
	CONFIGURATION_TABS,
} from "@/features/configuration/constants/configuration-fields"
import type { ConfigurationItem } from "@/features/configuration/types/configuration.types"
import cs from "@/i18n/cs.json"
import { sectionsFor } from "../lib/configuration-form"
import { firstTabWithKeys, tabFromParam, tabsOf, tabsWithKeys } from "../lib/configuration-tabs"

const ITEMS: ConfigurationItem[] = [
	{ key: CONFIGURATION_KEY.LOGIN_METHOD_PIN, value: true },
	{ key: CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES, value: 5 },
	{ key: CONFIGURATION_KEY.SYSLOG_PORT, value: 6514 },
]

describe("configuration tabs DESIGN.md 9.1", () => {
	it("places every setting in exactly one group", () => {
		const keys = CONFIGURATION_SECTIONS.flatMap((section) => section.fields.map((field) => field.key))
		expect(new Set(keys).size).toBe(keys.length)
	})

	it("names every tab and every group in Czech", () => {
		for (const tab of CONFIGURATION_TABS) {
			expect(cs.configuration.tabs[tab]).toBeTruthy()
		}
		const headings: Readonly<Record<string, { heading: string } | undefined>> = cs.configuration.sections
		for (const section of CONFIGURATION_SECTIONS) {
			expect(headings[section.id]?.heading).toBeTruthy()
		}
	})

	it("shows only the tabs that hold a setting the server returned", () => {
		const tabs = tabsOf(sectionsFor(ITEMS))
		expect(tabs.map((tab) => tab.id)).toEqual([
			CONFIGURATION_TAB.LOGIN,
			CONFIGURATION_TAB.RECORDS,
			CONFIGURATION_TAB.INTEGRATIONS,
		])
	})

	it("opens the tab from the address and falls back to the first one", () => {
		const tabs = tabsOf(sectionsFor(ITEMS))
		expect(tabFromParam(CONFIGURATION_TAB.RECORDS, tabs)).toBe(CONFIGURATION_TAB.RECORDS)
		expect(tabFromParam(CONFIGURATION_TAB.PATIENTS, tabs)).toBe(CONFIGURATION_TAB.LOGIN)
		expect(tabFromParam(null, tabs)).toBe(CONFIGURATION_TAB.LOGIN)
	})

	it("marks the tabs that hold changed or invalid settings and finds the first of them", () => {
		const tabs = tabsOf(sectionsFor(ITEMS))
		const keys = [CONFIGURATION_KEY.SYSLOG_PORT, CONFIGURATION_KEY.ACQUISITION_MAX_IMAGES]
		expect(tabsWithKeys(tabs, keys)).toEqual(new Set([CONFIGURATION_TAB.RECORDS, CONFIGURATION_TAB.INTEGRATIONS]))
		expect(firstTabWithKeys(tabs, keys)).toBe(CONFIGURATION_TAB.RECORDS)
		expect(firstTabWithKeys(tabs, [])).toBeUndefined()
	})
})
