export function optionalText(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined
}

export function boundedText(text: string, maxLength: number): string | undefined {
	const trimmed = text.trim()
	return trimmed.length === 0 || trimmed.length > maxLength ? undefined : trimmed
}
