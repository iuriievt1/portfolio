import type { MONITORED_DEPENDENCY } from "@ansora/contracts"

// CAP-028-R20
export type WorkerDependency = typeof MONITORED_DEPENDENCY.DATABASE | typeof MONITORED_DEPENDENCY.CLINICAL_RECORD_STORE
