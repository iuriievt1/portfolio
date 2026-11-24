export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
export type JsonObject = { [key: string]: JsonValue }

function isJsonObject(value: JsonValue): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function canonicalJson(value: JsonValue): string {
	if (typeof value === "number" && !Number.isFinite(value)) {
		throw new Error("canonical JSON cannot carry a non-finite number")
	}
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`
	}
	if (isJsonObject(value)) {
		const members: string[] = []
		for (const key of Object.keys(value).sort()) {
			const member = value[key]
			if (member !== undefined) {
				members.push(`${JSON.stringify(key)}:${canonicalJson(member)}`)
			}
		}
		return `{${members.join(",")}}`
	}
	return JSON.stringify(value)
}
