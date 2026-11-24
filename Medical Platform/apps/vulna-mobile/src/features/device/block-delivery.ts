import type { IntegrityBlock } from "@ansora/core-mobile"

// CAP-008-R04, CAP-008-S03, CAP-025-S16
export const BLOCK_DELIVERY = {
	REPORTED: "reported",
	AWAITING: "awaiting",
	UNREPORTED: "unreported",
} as const

export type BlockDelivery = (typeof BLOCK_DELIVERY)[keyof typeof BLOCK_DELIVERY]

// CAP-008-R04, CAP-008-S03, CAP-025-S16, procesy-a-stavy.md 2.4
export function deliveryOf(block: IntegrityBlock): BlockDelivery {
	if (block.reportedAt !== undefined) {
		return BLOCK_DELIVERY.REPORTED
	}
	return block.reportAbandonedAt === undefined ? BLOCK_DELIVERY.AWAITING : BLOCK_DELIVERY.UNREPORTED
}
