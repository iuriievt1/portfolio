import type { CodeListSet } from "../../api/code-lists"
import type { AcquisitionDetail } from "../../api/record"

export interface RecordContent {
	detail: AcquisitionDetail
	codeLists: CodeListSet
}

interface HeldRecord {
	content: RecordContent
	holders: number
}

const held = new Map<string, HeldRecord>()

// CAP-020-R02, CAP-025-R28
export function heldRecordOf(acquisitionId: string): RecordContent | undefined {
	return held.get(acquisitionId)?.content
}

// CAP-020-R02
export function holdRecord(acquisitionId: string, content: RecordContent): () => void {
	const holders = (held.get(acquisitionId)?.holders ?? 0) + 1
	held.set(acquisitionId, { content, holders })
	return () => release(acquisitionId)
}

function release(acquisitionId: string): void {
	const current = held.get(acquisitionId)
	if (current === undefined) {
		return
	}
	if (current.holders > 1) {
		held.set(acquisitionId, { ...current, holders: current.holders - 1 })
		return
	}
	held.delete(acquisitionId)
}
