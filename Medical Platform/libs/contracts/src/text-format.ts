const SECURE_PROTOCOL = "https:"
const WEB_PROTOCOLS = new Set(["http:", SECURE_PROTOCOL])
const IDENTIFIER_SEPARATORS = /[ /]/g

// konfigurace-a-profily.md 2.1, CAP-012-R30
export function isWebAddress(text: string): boolean {
	return URL.canParse(text) && WEB_PROTOCOLS.has(new URL(text).protocol)
}

// CAP-011-R02, CAP-010-R13
export function isSecureWebAddress(text: string): boolean {
	return URL.canParse(text) && new URL(text).protocol === SECURE_PROTOCOL
}

// CAP-013-R03
export function hasCapturingGroup(pattern: string): boolean {
	try {
		return (new RegExp(`${pattern}|`).exec("")?.length ?? 1) > 1
	} catch {
		return false
	}
}

// CAP-013-R17, CHG-182
export function identifierSearchTextOf(query: string): string {
	return query.trim().replace(IDENTIFIER_SEPARATORS, "")
}
