import type { StoredBinary } from "@ansora/core-server"

// datovy-model.md 4 „Binární objekt“
export interface SetAsideObjectRow {
	id: string
	size_bytes: string
	created_at: Date
}

// CAP-026-R14, backend.md 2.1
export interface UnrecordedBinary extends StoredBinary {
	sha256: string
}

export interface OrphanCleanupRun {
	setAsideCount: number
}
