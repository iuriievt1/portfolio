import { useEffect } from "react"
import { onQueuedClosureSettled } from "../closure-queue"

// CAP-019-R28, CAP-019-S20
export function useReloadAfterClosure(reload: () => void): void {
	useEffect(() => onQueuedClosureSettled(reload), [reload])
}
