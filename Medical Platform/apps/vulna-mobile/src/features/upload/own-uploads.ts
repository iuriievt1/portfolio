import { transferBuffer } from "./transfer-store"
import { ownAwaitingFileCountOf } from "./waiting-files"

// CAP-002-R14, CAP-019-R24
export async function readOwnAwaitingFileCount(userId: string): Promise<number> {
	const files = await (await transferBuffer()).queued()
	return ownAwaitingFileCountOf(files, userId)
}
