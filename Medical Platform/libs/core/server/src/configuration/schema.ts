export interface Schema {
	$schema?: string
	$id?: string
	$ref?: string
	$defs?: Record<string, Schema>
	title?: string
	description?: string
	default?: unknown
	type?: string | string[]
	properties?: Record<string, Schema>
	required?: string[]
	additionalProperties?: boolean
	items?: Schema
	enum?: unknown[]
	pattern?: string
	minItems?: number
	uniqueItems?: boolean
	minimum?: number
	maximum?: number
	readOnly?: boolean
}

const KEYWORDS = new Set(
	Object.keys({
		$schema: 0,
		$id: 0,
		$ref: 0,
		$defs: 0,
		title: 0,
		description: 0,
		default: 0,
		type: 0,
		properties: 0,
		required: 0,
		additionalProperties: 0,
		items: 0,
		enum: 0,
		pattern: 0,
		minItems: 0,
		uniqueItems: 0,
		minimum: 0,
		maximum: 0,
		readOnly: 0,
	} satisfies Record<keyof Schema, 0>),
)
const DEFINITIONS_PREFIX = "#/$defs/"

function typeOf(value: unknown): string {
	if (value === null) {
		return "null"
	}
	if (Array.isArray(value)) {
		return "array"
	}
	if (typeof value === "number") {
		return Number.isInteger(value) ? "integer" : "number"
	}
	return typeof value
}

function matchesType(value: unknown, type: string): boolean {
	const actual = typeOf(value)
	return actual === type || (type === "number" && actual === "integer")
}

function resolve(schema: Schema, root: Schema): Schema {
	if (schema.$ref === undefined) {
		return schema
	}
	if (!schema.$ref.startsWith(DEFINITIONS_PREFIX)) {
		throw new Error(`unsupported $ref: ${schema.$ref}`)
	}
	const definition = root.$defs?.[schema.$ref.slice(DEFINITIONS_PREFIX.length)]
	if (definition === undefined) {
		throw new Error(`unknown $ref: ${schema.$ref}`)
	}
	return definition
}

export function validate(value: unknown, schema: Schema, root: Schema = schema, path = "$"): string[] {
	for (const keyword of Object.keys(schema)) {
		if (!KEYWORDS.has(keyword)) {
			throw new Error(`unsupported schema keyword: ${keyword}`)
		}
	}
	const resolved = resolve(schema, root)
	if (resolved !== schema) {
		return validate(value, resolved, root, path)
	}
	const problems: string[] = []

	if (schema.type !== undefined) {
		const types = Array.isArray(schema.type) ? schema.type : [schema.type]
		if (!types.some((type) => matchesType(value, type))) {
			problems.push(`${path}: expected ${types.join(" or ")}, got ${typeOf(value)}`)
			return problems
		}
	}
	if (schema.enum !== undefined && !schema.enum.some((allowed) => allowed === value)) {
		problems.push(`${path}: expected one of ${schema.enum.map(String).join(", ")}`)
	}
	if (schema.pattern !== undefined && typeof value === "string" && !new RegExp(schema.pattern).test(value)) {
		problems.push(`${path}: does not match ${schema.pattern}`)
	}
	if (typeof value === "number") {
		if (schema.minimum !== undefined && value < schema.minimum) {
			problems.push(`${path}: below ${schema.minimum}`)
		}
		if (schema.maximum !== undefined && value > schema.maximum) {
			problems.push(`${path}: above ${schema.maximum}`)
		}
	}
	if (Array.isArray(value)) {
		if (schema.minItems !== undefined && value.length < schema.minItems) {
			problems.push(`${path}: fewer than ${schema.minItems} items`)
		}
		if (schema.uniqueItems === true && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) {
			problems.push(`${path}: duplicate items`)
		}
		if (schema.items !== undefined) {
			for (const [index, item] of value.entries()) {
				problems.push(...validate(item, schema.items, root, `${path}[${index}]`))
			}
		}
	}
	if (typeOf(value) === "object") {
		const record = value as Record<string, unknown>
		for (const key of schema.required ?? []) {
			if (!(key in record)) {
				problems.push(`${path}.${key}: missing`)
			}
		}
		for (const [key, child] of Object.entries(record)) {
			const property = schema.properties?.[key]
			if (property !== undefined) {
				problems.push(...validate(child, property, root, `${path}.${key}`))
			} else if (schema.additionalProperties === false) {
				problems.push(`${path}.${key}: unknown key`)
			}
		}
	}
	return problems
}
