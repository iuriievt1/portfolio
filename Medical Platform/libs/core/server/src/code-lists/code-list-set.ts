// CAP-017-R09, pg_advisory_xact_lock
export const CODE_LIST_SET_LOCK_KEY = 1_668_052_852

export const FIRST_CODE_LIST_SET_VERSION = 1

// clinical-workflow.yaml CodeListSet.version
export function codeListSetVersionText(version: number): string {
	return String(version)
}

const VERSION_TEXT = /^[1-9]\d{0,8}$/

export function codeListSetVersionOf(text: string): number | undefined {
	return VERSION_TEXT.test(text) ? Number(text) : undefined
}
