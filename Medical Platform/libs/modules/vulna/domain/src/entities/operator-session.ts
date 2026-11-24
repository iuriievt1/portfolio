// CAP-021-R13, CAP-019-R29
export interface SessionSpan {
	startedAt: Date
	sessionEnd: Date
	endedAt: Date | null
}

// CAP-021-R13, CAP-019-R29, datovy-model.md 4
export function wasSessionRunningAt(session: SessionSpan, moment: Date): boolean {
	const at = moment.getTime()
	const hasStarted = session.startedAt.getTime() <= at
	const isBeforeSessionEnd = at < session.sessionEnd.getTime()
	const isBeforeEnding = session.endedAt === null || at < session.endedAt.getTime()
	return hasStarted && isBeforeSessionEnd && isBeforeEnding
}
