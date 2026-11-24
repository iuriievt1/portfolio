export const JSON_MEDIA_TYPE = "application/json"

export function optionalText(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined
}

export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}
