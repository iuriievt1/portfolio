export const NATIVE_ERROR_CODE = {
	PIN_ACCOUNT_MISSING: "pin-account-missing",
	// E17
	STORAGE_FULL: "storage-full",
	// E18
	PHOTO_UNREADABLE: "photo-unreadable",
	// CAP-018-R02
	SCANNER_NOT_READY: "scanner-not-ready",
	// CAP-009-S05, Q-076
	FILE_KEY_INVALID: "file-key-invalid",
	FILE_UNAVAILABLE: "file-unavailable",
	KEY_INVALIDATED: "key-invalidated",
} as const

export function nativeErrorCodeOf(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null)?.code
	return typeof code === "string" ? code : undefined
}
