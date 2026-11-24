import { useMemo } from "react"
import { isClosingQueuedFor } from "../closure-queue"
import { useQueueRead } from "./use-queue-read"

// CAP-019-R29, CAP-019-S21, E9
export function useClosingQueuedFor(personalNumber: string | undefined): boolean {
	const read = useMemo(
		() => (personalNumber === undefined ? undefined : () => isClosingQueuedFor(personalNumber)),
		[personalNumber],
	)
	return useQueueRead(read, false)
}
