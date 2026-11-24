import { isRecordFile } from "@ansora/core-mobile"
import { transferBuffer } from "./transfer-store"

// CAP-015-R36, CAP-009-S05, Q-076
export async function retakeRecordIdsOf(operatorUserId: string): Promise<ReadonlySet<string>> {
	const failed = await (await transferBuffer()).failedInRecords(operatorUserId)
	return new Set(failed.filter(isRecordFile).map((file) => file.acquisitionId))
}
