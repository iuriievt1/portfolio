import { currentSession } from "../../session/session-store"
import { type QueueView, queueViewOf } from "../queue-view"
import { useQueuedFiles } from "./use-queued-files"

// CAP-019-R08, CAP-019-R23
export function useQueueView(): QueueView | undefined {
	const files = useQueuedFiles()
	const userId = currentSession()?.user.id
	return files === undefined || userId === undefined ? undefined : queueViewOf(files, userId)
}
