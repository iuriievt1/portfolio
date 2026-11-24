interface PendingUpdate {
	body: string
	requestKey: string
}

const pending = new Map<string, PendingUpdate>()

// CAP-021-R29, CAP-021-S23, CAP-021-S24
export async function requestKeyOf(
	acquisitionId: string,
	body: string,
	newKey: () => Promise<string>,
): Promise<string> {
	const unanswered = pending.get(acquisitionId)
	if (unanswered?.body === body) {
		return unanswered.requestKey
	}
	const requestKey = await newKey()
	pending.set(acquisitionId, { body, requestKey })
	return requestKey
}

export function settleRequestKey(acquisitionId: string): void {
	pending.delete(acquisitionId)
}

// CAP-013-R08
export function forgetRequestKeys(): void {
	pending.clear()
}
