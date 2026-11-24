import { storedSeconds } from "../../utils/stored-seconds"

// CAP-026-R08, identity.yaml EffectiveConfiguration device_local_copy_seconds
const localCopyRetention = storedSeconds("ansora.vulna.local-copy-seconds")

export const rememberLocalCopyRetention = localCopyRetention.remember

export const localCopyRetentionSeconds = localCopyRetention.read
