let awaitedClosingId: string | undefined
let isResumeDue = false

// CAP-015-S09
export function awaitClosingBeforeSignOut(acquisitionId: string): void {
	awaitedClosingId = acquisitionId
}

// CAP-015-S09
export function resumeSignOutAfterClosing(acquisitionId: string): boolean {
	if (awaitedClosingId !== acquisitionId) {
		return false
	}
	awaitedClosingId = undefined
	isResumeDue = true
	return true
}

export function takeResumedSignOut(): boolean {
	const wasDue = isResumeDue
	isResumeDue = false
	return wasDue
}

export function stopAwaitingClosing(acquisitionId: string): void {
	if (awaitedClosingId === acquisitionId) {
		awaitedClosingId = undefined
	}
}

export function forgetSignOutResume(): void {
	awaitedClosingId = undefined
	isResumeDue = false
}
