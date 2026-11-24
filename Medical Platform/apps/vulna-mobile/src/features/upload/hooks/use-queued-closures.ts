import { currentSession } from "../../session/session-store"
import { queuedClosureIdsOf } from "../closure-queue"
import { useQueueRead } from "./use-queue-read"

const NO_CLOSURES: ReadonlySet<string> = new Set()

async function readOwnQueuedClosureIds(): Promise<ReadonlySet<string>> {
	const userId = currentSession()?.user.id
	return userId === undefined ? NO_CLOSURES : await queuedClosureIdsOf(userId)
}

// CAP-019-R29, E91, E93, E103
export function useQueuedClosureIds(): ReadonlySet<string> {
	return useQueueRead(readOwnQueuedClosureIds, NO_CLOSURES)
}
