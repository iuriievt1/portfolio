import {
	type BlockLeavePorts,
	blockForSignals,
	cryptoAndKeys,
	hardwareIdOf,
	type IntegrityBlock,
	type IntegrityBlockPorts,
	type IntegrityPorts,
	integrityBlock,
	leaveBlockForNewRegistration,
	OS_INTEGRITY_EVENT,
	osIntegrity,
} from "@ansora/core-mobile"
import { blockMarkers } from "./block-markers"
import { forgetRegistration, isDeviceRegistered } from "./device-registration"
import { integrityBlocks } from "./integrity-blocks"
import { afterEarlierErasure } from "./remote-erasure"

const BLOCK_PORTS: IntegrityBlockPorts = {
	blocks: integrityBlocks,
	isRegistered: isDeviceRegistered,
	hardwareId: () => hardwareIdOf(cryptoAndKeys()),
	now: () => new Date(),
}

const OS_INTEGRITY = { detect: () => osIntegrity().detect() }

const INTEGRITY_PORTS: IntegrityPorts = { ...BLOCK_PORTS, integrity: OS_INTEGRITY }

const LEAVE_PORTS: BlockLeavePorts = {
	blocks: integrityBlocks,
	hardwareId: BLOCK_PORTS.hardwareId,
	integrity: OS_INTEGRITY,
	markers: blockMarkers,
	forgetRegistration,
}

// CAP-008-R01, CAP-008-R03, CAP-008-R10, CAP-006-S13
export async function checkDeviceIntegrity(): Promise<IntegrityBlock | undefined> {
	const block = await integrityBlock(INTEGRITY_PORTS)
	if (block === undefined) {
		return undefined
	}
	return (await leaveIntegrityBlock()) ? undefined : block
}

// CAP-006-R19, CAP-006-S13, CAP-025-R22
export function leaveIntegrityBlock(): Promise<boolean> {
	return afterEarlierErasure(() => leaveBlockForNewRegistration(LEAVE_PORTS))
}

// CAP-008-R01, CAP-008-S02
export function watchDeviceIntegrity(onBlock: (block: IntegrityBlock) => void): () => void {
	let isWatching = true
	try {
		const subscription = osIntegrity().addListener(OS_INTEGRITY_EVENT.DETECTED, ({ signals }) => {
			blockForSignals(BLOCK_PORTS, signals)
				.then((block) => {
					if (isWatching && block !== undefined) {
						onBlock(block)
					}
				})
				.catch((failure: unknown) => console.warn("the device could not be blocked", failure))
		})
		return () => {
			isWatching = false
			subscription.remove()
		}
	} catch (failure) {
		console.warn("the integrity of the device cannot be watched", failure)
		return () => undefined
	}
}
