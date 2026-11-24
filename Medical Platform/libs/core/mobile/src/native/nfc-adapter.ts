const MISSING_ADAPTER = "no nfc support"

export function isMissingAdapter(failure: unknown): boolean {
	const message = failure instanceof Error ? failure.message : failure
	return message === MISSING_ADAPTER
}
