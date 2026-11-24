import type { BufferedFile } from "@ansora/core-mobile"
import { transferBuffer } from "../transfer-store"
import { useQueueRead } from "./use-queue-read"

async function readQueuedFiles(): Promise<readonly BufferedFile[] | undefined> {
	return await (await transferBuffer()).queued()
}

// CAP-019-R08, CAP-019-R23
export function useQueuedFiles(): readonly BufferedFile[] | undefined {
	return useQueueRead(readQueuedFiles, undefined)
}
