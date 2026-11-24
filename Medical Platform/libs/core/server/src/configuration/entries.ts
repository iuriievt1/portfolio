export type ConfigurationEntry = [key: string, value: unknown]

const KEY_SEPARATOR = "."

function isSection(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function configurationEntries(sections: Readonly<Record<string, unknown>>): ConfigurationEntry[] {
	const entries: ConfigurationEntry[] = []
	for (const [section, values] of Object.entries(sections)) {
		if (!isSection(values)) {
			throw new Error(`configuration section ${section} is not an object`)
		}
		for (const [key, value] of Object.entries(values)) {
			entries.push([`${section}${KEY_SEPARATOR}${key}`, value])
		}
	}
	return entries
}

export function parseConfigurationKey(key: string): { section: string; name: string } | undefined {
	const separator = key.indexOf(KEY_SEPARATOR)
	if (separator <= 0 || separator === key.length - 1) {
		return undefined
	}
	return { section: key.slice(0, separator), name: key.slice(separator + 1) }
}

export function configurationSections(entries: Iterable<ConfigurationEntry>): Record<string, Record<string, unknown>> {
	const sections: Record<string, Record<string, unknown>> = {}
	for (const [key, value] of entries) {
		const parsed = parseConfigurationKey(key)
		if (parsed === undefined) {
			throw new Error(`configuration key ${key} is not section.key`)
		}
		sections[parsed.section] = { ...sections[parsed.section], [parsed.name]: value }
	}
	return sections
}
