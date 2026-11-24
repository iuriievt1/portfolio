const COOKIE_SEPARATOR = ";"
const VALUE_SEPARATOR = "="

export function cookieValue(header: string | undefined, name: string): string | undefined {
	if (header === undefined) {
		return undefined
	}
	for (const part of header.split(COOKIE_SEPARATOR)) {
		const separator = part.indexOf(VALUE_SEPARATOR)
		if (separator === -1 || part.slice(0, separator).trim() !== name) {
			continue
		}
		const value = part.slice(separator + 1).trim()
		return value === "" ? undefined : value
	}
	return undefined
}
