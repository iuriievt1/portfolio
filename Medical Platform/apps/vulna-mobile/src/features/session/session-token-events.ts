import { signal } from "../../utils/signal"

const sessionTokenIssued = signal()

// clinical-workflow.yaml reportQueueState
export const markSessionTokenIssued = sessionTokenIssued.emit

export const onSessionTokenIssued = sessionTokenIssued.listen
