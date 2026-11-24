import { createHash } from "node:crypto"
import type { StoredBinary } from "@ansora/core-server"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import type { BufferStore } from "../../../libs/binary-store/binary-store.types"
import { BINARY_OBJECT_KEY_PATTERN, ORPHAN_CLEANUP_BATCH_SIZE } from "../constants/orphan-cleanup.constants"
import { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import type { UnrecordedBinary } from "../types/orphan-cleanup.types"

const SHA256 = "sha256"
const HEX = "hex"

function isAgedObject(stored: StoredBinary, cutoff: Date): boolean {
	return BINARY_OBJECT_KEY_PATTERN.test(stored.key) && stored.storedAt.getTime() <= cutoff.getTime()
}

// CAP-026-R14, CAP-026-S06, CAP-026-S07, backend.md 2.1, dorucovaci-jadro.md 2
@Injectable()
export class UnrecordedBinaryService {
	private readonly logger = new Logger(UnrecordedBinaryService.name)

	constructor(
		@Inject(BINARY_STORE) private readonly store: BufferStore,
		private readonly objects: OrphanedObjectRepository,
	) {}

	async storedBefore(cutoff: Date): Promise<UnrecordedBinary[]> {
		const unrecorded: StoredBinary[] = []
		let candidates: StoredBinary[] = []
		for await (const stored of this.store.list()) {
			if (!isAgedObject(stored, cutoff)) {
				continue
			}
			candidates.push(stored)
			if (candidates.length < ORPHAN_CLEANUP_BATCH_SIZE) {
				continue
			}
			unrecorded.push(...(await this.unrecordedAmong(candidates)))
			candidates = []
			if (unrecorded.length >= ORPHAN_CLEANUP_BATCH_SIZE) {
				break
			}
		}
		unrecorded.push(...(await this.unrecordedAmong(candidates)))
		return await this.digestedOf(unrecorded.slice(0, ORPHAN_CLEANUP_BATCH_SIZE))
	}

	private async unrecordedAmong(candidates: readonly StoredBinary[]): Promise<StoredBinary[]> {
		if (candidates.length === 0) {
			return []
		}
		const recorded = await this.objects.recordedKeys(candidates.map((stored) => stored.key))
		return candidates.filter((stored) => !recorded.has(stored.key))
	}

	private async digestedOf(binaries: readonly StoredBinary[]): Promise<UnrecordedBinary[]> {
		const digested: UnrecordedBinary[] = []
		for (const binary of binaries) {
			try {
				digested.push({ ...binary, sha256: await this.sha256Of(binary.key) })
			} catch (error) {
				this.logger.warn(
					`The bytes of unrecorded binary object ${binary.key} cannot be read; the next run retries`,
					error,
				)
			}
		}
		return digested
	}

	private async sha256Of(key: string): Promise<string> {
		const hash = createHash(SHA256)
		for await (const chunk of await this.store.get(key)) {
			hash.update(chunk)
		}
		return hash.digest(HEX)
	}
}
