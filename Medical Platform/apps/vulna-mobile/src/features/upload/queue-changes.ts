import { signal } from "../../utils/signal"

const queueChange = signal()

// CAP-019-R23
export const markQueueChanged = queueChange.emit

export const onQueueChange = queueChange.listen
