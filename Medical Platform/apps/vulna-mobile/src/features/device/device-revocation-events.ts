import { signal } from "../../utils/signal"

const deviceRevoked = signal()

// CAP-007-R11
export const noteDeviceRevoked = deviceRevoked.emit

export const onDeviceRevoked = deviceRevoked.listen
