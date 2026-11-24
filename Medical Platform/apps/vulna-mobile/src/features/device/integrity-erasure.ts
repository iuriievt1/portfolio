import {
	type IntegrityBlock,
	type IntegrityDeletionPorts,
	type IntegrityReportPorts,
	keepBlock,
	recordIntegrityDeletion,
	reportIntegrityBlock,
	storedIntegrityBlock,
} from "@ansora/core-mobile"
import { reportDeviceIntegrity } from "../../api/device"
import { currentSession } from "../session/session-store"
import { stopUploadQueue } from "../upload/upload-queue"
import { deviceKeyHoldSeconds } from "./device-key-hold"
import { integrityBlocks } from "./integrity-blocks"
import { afterEarlierErasure, ERASURE_PORTS, eraseLocalData, unsentItems } from "./remote-erasure"

const DELETION_PORTS: IntegrityDeletionPorts = {
	...ERASURE_PORTS,
	blocks: integrityBlocks,
}

const REPORT_PORTS: IntegrityReportPorts = {
	...ERASURE_PORTS,
	blocks: integrityBlocks,
	reportIntegrity: reportDeviceIntegrity,
}

// CAP-008-R06, CAP-008-R10, CAP-008-R13, CAP-008-S03
export function eraseAfterIntegrityBlock(block: IntegrityBlock): Promise<IntegrityBlock> {
	return afterEarlierErasure(() => erase(block))
}

// CAP-008-R04, CAP-008-R10, CAP-008-S03, CAP-025-R22
export function reportBlockToServer(block: IntegrityBlock): Promise<IntegrityBlock> {
	return afterEarlierErasure(async () => {
		await reportIntegrityBlock(REPORT_PORTS, block)
		return (await storedIntegrityBlock(integrityBlocks)) ?? block
	})
}

async function erase(handed: IntegrityBlock): Promise<IntegrityBlock> {
	stopUploadQueue()
	const block = { ...handed, ...(await storedIntegrityBlock(integrityBlocks)) }
	const recorded = await withRecordedDeletion(await withLostItems(block))
	await eraseLocalData()
	return recorded
}

// CAP-008-R11, zarizeni-a-sifrovani.md 3
async function withLostItems(block: IntegrityBlock): Promise<IntegrityBlock> {
	if (block.unsentItems !== undefined) {
		return block
	}
	const counted = { ...block, unsentItems: await unsentItems() }
	await keepBlock(integrityBlocks, counted)
	return counted
}

// CAP-008-R09, CAP-025-R22
async function withRecordedDeletion(block: IntegrityBlock): Promise<IntegrityBlock> {
	try {
		const context = { userId: currentSession()?.user.id ?? null, deviceKeyHoldSeconds: await deviceKeyHoldSeconds() }
		return await recordIntegrityDeletion(DELETION_PORTS, block, context)
	} catch (failure) {
		console.warn("the deletion could not be recorded for the server", failure)
		return block
	}
}
