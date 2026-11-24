import { waitingFileCountOf } from "../waiting-files"
import { useQueuedFiles } from "./use-queued-files"

// CAP-012-R25, CAP-019-R23
export function useWaitingFileCount(): number | undefined {
	const files = useQueuedFiles()
	return files === undefined ? undefined : waitingFileCountOf(files)
}
