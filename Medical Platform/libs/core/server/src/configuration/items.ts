import type { AdministrationContract } from "@ansora/contracts"
import { type ConfigurationEntry, parseConfigurationKey } from "./entries"
import type { Schema } from "./schema"

export type ConfigurationItem = AdministrationContract.components["schemas"]["ConfigurationItem"]

const OWNER_SERVER = "server"

export function configurationProperty(schema: Schema, key: string): Schema | undefined {
	const parsed = parseConfigurationKey(key)
	if (parsed === undefined) {
		return undefined
	}
	return schema.properties?.[parsed.section]?.properties?.[parsed.name]
}

// konfigurace-a-profily.md 2.7, 7, ADR-035
export function isProfileOnly(schema: Schema, key: string): boolean {
	return configurationProperty(schema, key)?.readOnly === true
}

function schemaDefaults(schema: Schema): ConfigurationEntry[] {
	return Object.entries(schema.properties ?? {}).flatMap(([section, sectionSchema]) =>
		Object.entries(sectionSchema.properties ?? {})
			.filter(([, property]) => "default" in property)
			.map(([name, property]): ConfigurationEntry => [`${section}.${name}`, property.default]),
	)
}

// konfigurace-a-profily.md 7
export function effectiveEntries(schema: Schema, entries: readonly ConfigurationEntry[]): ConfigurationEntry[] {
	const stored = new Set(entries.map(([key]) => key))
	return [...entries, ...schemaDefaults(schema).filter(([key]) => !stored.has(key))]
}

export function configurationItems(schema: Schema, entries: readonly ConfigurationEntry[]): ConfigurationItem[] {
	return effectiveEntries(schema, entries)
		.filter(([key]) => !isProfileOnly(schema, key))
		.map(([key, value]) => {
			const property = configurationProperty(schema, key)
			const item: ConfigurationItem = { key, value, owner: OWNER_SERVER }
			if (property === undefined) {
				return item
			}
			if ("default" in property) {
				item.default_value = property.default
			}
			if (property.minimum !== undefined) {
				item.lower_limit = property.minimum
			}
			if (property.maximum !== undefined) {
				item.upper_limit = property.maximum
			}
			const allowed = property.enum ?? property.items?.enum
			if (allowed !== undefined) {
				item.allowed_values = allowed
			}
			return item
		})
}
