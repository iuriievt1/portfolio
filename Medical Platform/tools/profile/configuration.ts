import type { Schema } from "@ansora/core-server"
import type { AdapterManifest, ConfigurationItem } from "./model"

export interface ObjectSchema extends Schema {
	type: "object"
	additionalProperties: false
	properties: Record<string, Schema>
}

export interface ConfigurationSchema extends ObjectSchema {
	$schema?: string
	title?: string
	description?: string
}

const ADAPTER_PREFIX = /^@ansora\/[a-z0-9]+-adapter-/

export function adapterKey(name: string): string {
	return name.replace(ADAPTER_PREFIX, "").replace(/-/g, "_")
}

function adapterProperty(item: ConfigurationItem): Schema {
	const property: Schema = { type: item.type }
	if ("default" in item) {
		property.default = item.default
	}
	if (item.enum !== undefined) {
		property.enum = item.enum
	}
	if (item.minimum !== undefined) {
		property.minimum = item.minimum
	}
	if (item.maximum !== undefined) {
		property.maximum = item.maximum
	}
	if (item.pattern !== undefined) {
		property.pattern = item.pattern
	}
	if (item.description !== undefined) {
		property.description = item.description
	}
	return property
}

function adapterSchema(items: Record<string, ConfigurationItem>): ObjectSchema {
	const properties: Record<string, Schema> = {}
	const required: string[] = []
	for (const [key, item] of Object.entries(items)) {
		properties[key] = adapterProperty(item)
		if (item.required === true) {
			required.push(key)
		}
	}
	return required.length === 0
		? { type: "object", additionalProperties: false, properties }
		: { type: "object", additionalProperties: false, required, properties }
}

export function composeConfigurationSchema(
	core: ConfigurationSchema,
	manifests: readonly AdapterManifest[],
): ConfigurationSchema {
	const properties = { ...core.properties }
	for (const manifest of [...manifests].sort((a, b) => a.name.localeCompare(b.name))) {
		properties[adapterKey(manifest.name)] = adapterSchema(manifest.configurationSchema ?? {})
	}
	return { ...core, properties }
}

function isObjectSchema(schema: Schema): schema is ObjectSchema {
	return schema.type === "object" && schema.properties !== undefined
}

export function configurationDefaults(schema: ObjectSchema): Record<string, unknown> {
	const defaults: Record<string, unknown> = {}
	for (const [key, property] of Object.entries(schema.properties)) {
		if (isObjectSchema(property)) {
			const nested = configurationDefaults(property)
			if (Object.keys(nested).length > 0) {
				defaults[key] = nested
			}
		} else if ("default" in property) {
			defaults[key] = property.default
		}
	}
	return defaults
}

export function outboundTargetKeys(manifests: readonly AdapterManifest[]): string[] {
	const keys: string[] = []
	for (const manifest of manifests) {
		for (const [key, item] of Object.entries(manifest.configurationSchema ?? {})) {
			if (item.outboundTarget === true) {
				keys.push(`${adapterKey(manifest.name)}.${key}`)
			}
		}
	}
	return keys.sort()
}
