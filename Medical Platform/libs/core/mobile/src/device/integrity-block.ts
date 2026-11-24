import { INTEGRITY_SIGNALS, type IntegritySignal } from "@ansora/contracts"
import type { OsIntegrity } from "../native"
import type { BlockMarkerStore } from "./block-marker"
import type { DeletedItems } from "./device-events"
import { isIsoMoment } from "./moment"

// CAP-008-R03, CAP-008-R13, CAP-006-R19
export interface IntegrityBlock {
	detectedAt: string
	signals: readonly IntegritySignal[]
	registered: boolean
	// CAP-008-R11
	unsentItems?: DeletedItems
	// CAP-008-R09, CAP-025-R22
	deletionRecordedAt?: string
	// CAP-008-R04, CAP-008-S03
	reportedAt?: string
	// CAP-008-S03, CAP-007-R11, CAP-025-S16
	reportAbandonedAt?: string
	// CAP-006-R19
	hwId?: string
}

export interface IntegrityBlockStore {
	read(): Promise<IntegrityBlock | undefined>
	write(block: IntegrityBlock): Promise<void>
	clear(): Promise<void>
}

export interface IntegrityBlockPorts {
	blocks: IntegrityBlockStore
	isRegistered(): Promise<boolean>
	hardwareId(): Promise<string>
	now(): Date
}

export interface IntegrityPorts extends IntegrityBlockPorts {
	integrity: Pick<OsIntegrity, "detect">
}

export interface BlockLeavePorts extends Pick<IntegrityPorts, "blocks" | "hardwareId" | "integrity"> {
	markers: BlockMarkerStore
	forgetRegistration(): Promise<void>
}

// CAP-008-R03, CAP-008-R07, CAP-008-R10, CAP-008-S01
export async function integrityBlock(ports: IntegrityPorts): Promise<IntegrityBlock | undefined> {
	return (await storedIntegrityBlock(ports.blocks)) ?? (await newBlock(ports, await detectedSignals(ports.integrity)))
}

// CAP-008-R03, CAP-008-R10, CAP-008-S02
export async function blockForSignals(
	ports: IntegrityBlockPorts,
	detected: readonly string[],
): Promise<IntegrityBlock | undefined> {
	return (await storedIntegrityBlock(ports.blocks)) ?? (await newBlock(ports, detected))
}

// CAP-006-R19, CAP-006-S13, CAP-008-R06, CAP-008-S04
export async function leaveBlockForNewRegistration(ports: BlockLeavePorts): Promise<boolean> {
	const block = await storedIntegrityBlock(ports.blocks)
	if (block?.hwId === undefined) {
		return false
	}
	try {
		if ((await ports.hardwareId()) === block.hwId) {
			return false
		}
		if (signalsOf(await ports.integrity.detect()).length > 0) {
			return false
		}
		await ports.markers.write({ predecessorHwId: block.hwId, detectedAt: block.detectedAt })
		await ports.forgetRegistration()
		await ports.blocks.clear()
		return true
	} catch (failure) {
		console.warn("the device could not leave its block for a new registration", failure)
		return false
	}
}

async function newBlock(ports: IntegrityBlockPorts, detected: readonly string[]): Promise<IntegrityBlock | undefined> {
	const signals = signalsOf(detected)
	if (signals.length === 0) {
		return undefined
	}
	const registered = await ports.isRegistered()
	const block: IntegrityBlock = { detectedAt: ports.now().toISOString(), signals, registered }
	const hwId = registered ? await blockedHardwareId(ports) : undefined
	const kept = hwId === undefined ? block : { ...block, hwId }
	await keepBlock(ports.blocks, kept)
	return kept
}

// CAP-006-R19
async function blockedHardwareId(ports: IntegrityBlockPorts): Promise<string | undefined> {
	try {
		return await ports.hardwareId()
	} catch (failure) {
		console.warn("the HW ID of the blocked registration could not be read", failure)
		return undefined
	}
}

// CAP-008-R03, CAP-008-R07
export async function storedIntegrityBlock(blocks: IntegrityBlockStore): Promise<IntegrityBlock | undefined> {
	try {
		return await blocks.read()
	} catch (failure) {
		console.warn("the block of the device could not be read", failure)
		return undefined
	}
}

// CAP-008-R03
export async function keepBlock(blocks: IntegrityBlockStore, block: IntegrityBlock): Promise<void> {
	try {
		await blocks.write(block)
	} catch (failure) {
		console.warn("the block of the device could not be stored", failure)
	}
}

// CAP-008-S04, zarizeni-a-sifrovani.md 3
async function detectedSignals(integrity: Pick<OsIntegrity, "detect">): Promise<readonly string[]> {
	try {
		return await integrity.detect()
	} catch (failure) {
		console.warn("the integrity of the device could not be checked", failure)
		return []
	}
}

function signalsOf(detected: readonly string[]): IntegritySignal[] {
	return INTEGRITY_SIGNALS.filter((signal) => detected.includes(signal))
}

// CAP-008-R03, CAP-006-R19
export function integrityBlockOf(stored: string | null): IntegrityBlock | undefined {
	if (stored === null) {
		return undefined
	}
	try {
		const parsed: unknown = JSON.parse(stored)
		return isIntegrityBlock(parsed) ? parsed : undefined
	} catch {
		return undefined
	}
}

function isIntegrityBlock(value: unknown): value is IntegrityBlock {
	if (typeof value !== "object" || value === null) {
		return false
	}
	const block = value as Partial<IntegrityBlock>
	return (
		isIsoMoment(block.detectedAt) &&
		Array.isArray(block.signals) &&
		block.signals.length > 0 &&
		block.signals.every((signal) => INTEGRITY_SIGNALS.includes(signal)) &&
		typeof block.registered === "boolean" &&
		(block.unsentItems === undefined || isDeletedItems(block.unsentItems)) &&
		isOptionalMoment(block.deletionRecordedAt) &&
		isOptionalMoment(block.reportedAt) &&
		isOptionalMoment(block.reportAbandonedAt) &&
		(block.hwId === undefined || (block.registered && typeof block.hwId === "string" && block.hwId.length > 0))
	)
}

function isDeletedItems(value: unknown): value is DeletedItems {
	if (typeof value !== "object" || value === null) {
		return false
	}
	const items = value as Partial<DeletedItems>
	const isCount = typeof items.count === "number" && Number.isInteger(items.count) && items.count >= 0
	return isCount && (items.oldestAcquiredAt === null || isIsoMoment(items.oldestAcquiredAt))
}

function isOptionalMoment(value: unknown): boolean {
	return value === undefined || isIsoMoment(value)
}
