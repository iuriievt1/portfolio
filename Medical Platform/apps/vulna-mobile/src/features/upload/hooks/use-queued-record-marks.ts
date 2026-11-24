import { useMemo } from "react"
import { currentSession } from "../../session/session-store"
import type { QueuedRecordMarks } from "../record-note"
import { retakeRecordIdsOf } from "../retake-records"
import { useQueueRead } from "./use-queue-read"
import { useQueuedClosureIds } from "./use-queued-closures"

const NO_RECORDS: ReadonlySet<string> = new Set()

async function readOwnRetakeRecordIds(): Promise<ReadonlySet<string>> {
	const userId = currentSession()?.user.id
	return userId === undefined ? NO_RECORDS : await retakeRecordIdsOf(userId)
}

// CAP-019-R29, CAP-015-R36, CAP-009-S05, E93, Q-076
export function useQueuedRecordMarks(): QueuedRecordMarks {
	const closings = useQueuedClosureIds()
	const retakes = useQueueRead(readOwnRetakeRecordIds, NO_RECORDS)
	return useMemo(() => ({ closings, retakes }), [closings, retakes])
}
