import { type IntegrityReport, LOCAL_DATA_DELETION_REASON } from "@ansora/contracts"
import type { DeletedItems } from "./device-events"
import { DEVICE_ERROR_CODE, type ProblemLike } from "./device-status"
import { type IntegrityBlock, type IntegrityBlockStore, keepBlock, storedIntegrityBlock } from "./integrity-block"
import {
	type DeletionRecordPorts,
	ERASURE_STATE,
	type ErasureContext,
	type ErasurePorts,
	type ErasureState,
	erasureReleaseAt,
	isHoldOver,
	recordLocalDataDeletion,
	reportErasure,
} from "./remote-erasure"

export interface IntegrityReportPorts extends ErasurePorts {
	blocks: IntegrityBlockStore
	reportIntegrity(report: IntegrityReport): Promise<void>
}

export interface IntegrityDeletionPorts extends Omit<DeletionRecordPorts, "unsentItems"> {
	blocks: IntegrityBlockStore
}

const NOTHING_LOST: DeletedItems = { count: 0, oldestAcquiredAt: null }

const DELIVERY = {
	DELIVERED: "delivered",
	REFUSED: "refused",
	PENDING: "pending",
} as const

type Delivery = (typeof DELIVERY)[keyof typeof DELIVERY]

// CAP-008-R06, CAP-008-R09, CAP-008-R13, CAP-025-R22
export async function recordIntegrityDeletion(
	ports: IntegrityDeletionPorts,
	block: IntegrityBlock,
	context: ErasureContext,
): Promise<IntegrityBlock> {
	if (!block.registered || block.deletionRecordedAt !== undefined) {
		return block
	}
	const lost = block.unsentItems ?? NOTHING_LOST
	await recordLocalDataDeletion(
		{ ...ports, unsentItems: async () => lost },
		{ ...context, reason: LOCAL_DATA_DELETION_REASON.OS_MODIFICATION },
	)
	const recorded = { ...block, deletionRecordedAt: ports.now().toISOString() }
	await keepBlock(ports.blocks, recorded)
	return recorded
}

// CAP-008-R04, CAP-008-R06, CAP-008-R10, CAP-008-S03, CAP-025-R22, Q-072
export async function reportIntegrityBlock(ports: IntegrityReportPorts, block: IntegrityBlock): Promise<ErasureState> {
	if (!block.registered) {
		return ERASURE_STATE.NONE
	}
	const current = { ...block, ...(await storedIntegrityBlock(ports.blocks)) }
	const releaseAt = await erasureReleaseAt(ports)
	if (releaseAt === undefined) {
		await reportWithoutHold(ports, current)
		return ERASURE_STATE.NONE
	}
	const canStillReport = isReportWaiting(current) && !isHoldOver(ports.now(), releaseAt)
	if (canStillReport && (await deliverReport(ports, current)) === DELIVERY.PENDING) {
		return ERASURE_STATE.REPORTING
	}
	const state = await reportErasure(ports)
	if (state === ERASURE_STATE.RELEASED) {
		await abandonUnsentReport(ports, current)
	}
	return state
}

// CAP-008-R10, CAP-025-S16
async function reportWithoutHold(ports: IntegrityReportPorts, block: IntegrityBlock): Promise<void> {
	if (block.deletionRecordedAt !== undefined) {
		await abandonUnsentReport(ports, block)
		return
	}
	if (isReportWaiting(block)) {
		await deliverReport(ports, block)
	}
}

function isReportWaiting(block: IntegrityBlock): boolean {
	return block.reportedAt === undefined && block.reportAbandonedAt === undefined
}

async function deliverReport(ports: IntegrityReportPorts, block: IntegrityBlock): Promise<Delivery> {
	try {
		await ports.reportIntegrity(integrityReportOf(block))
	} catch (failure) {
		if (isRefusedForGood(failure)) {
			await keepBlock(ports.blocks, { ...block, reportAbandonedAt: ports.now().toISOString() })
			return DELIVERY.REFUSED
		}
		console.warn("the block of the device could not be reported yet", failure)
		return DELIVERY.PENDING
	}
	await keepBlock(ports.blocks, { ...block, reportedAt: ports.now().toISOString() })
	return DELIVERY.DELIVERED
}

// CAP-008-R11, CAP-008-S07, CAP-008-S08
function integrityReportOf(block: IntegrityBlock): IntegrityReport {
	const lost = block.unsentItems ?? NOTHING_LOST
	return {
		signals: [...block.signals],
		detected_at: block.detectedAt,
		unsent_items: { count: lost.count, oldest_acquired_at: lost.oldestAcquiredAt },
	}
}

// procesy-a-stavy.md 2.1, CAP-007-R11
function isRefusedForGood(failure: unknown): boolean {
	return typeof failure === "object" && failure !== null && (failure as ProblemLike).code === DEVICE_ERROR_CODE.REVOKED
}

// CAP-025-S16
async function abandonUnsentReport(ports: IntegrityReportPorts, block: IntegrityBlock): Promise<void> {
	const current = { ...block, ...(await storedIntegrityBlock(ports.blocks)) }
	if (isReportWaiting(current)) {
		await keepBlock(ports.blocks, { ...current, reportAbandonedAt: ports.now().toISOString() })
	}
}
