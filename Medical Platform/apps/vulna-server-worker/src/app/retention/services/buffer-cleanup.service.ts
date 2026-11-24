import type { BinaryStorePort } from "@ansora/core-server"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { BINARY_STORE } from "../../../libs/binary-store/binary-store.constants"
import { DatabaseService } from "../../../libs/database/database.service"
import { RetentionRepository } from "../repositories/retention.repository"
import type { BufferCopyRow } from "../types/retention.types"
import { bufferCopyDeletionEventOf } from "../utils/retention-audit"

// CAP-026-R18, CAP-026-S15, CAP-026-S16, datovy-model.md 4 „Binární objekt“
@Injectable()
export class BufferCleanupService {
	private readonly logger = new Logger(BufferCleanupService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly retention: RetentionRepository,
		private readonly audit: AuditRepository,
		@Inject(BINARY_STORE) private readonly binaryStore: BinaryStorePort,
	) {}

	async run(now: Date): Promise<number> {
		let deletedCount = 0
		for (const copy of await this.retention.bufferCopies()) {
			try {
				await this.binaryStore.delete(copy.binary_object_id)
				if (await this.recordDeleted(copy, now)) {
					deletedCount++
				}
			} catch (error) {
				this.logger.error(`Deleting the buffer copy of binary object ${copy.binary_object_id} failed`, error)
			}
		}
		return deletedCount
	}

	private async recordDeleted(copy: BufferCopyRow, now: Date): Promise<boolean> {
		return await this.database.sql.begin(async (tx) => {
			if (!(await this.retention.markBufferDeleted(tx, copy.binary_object_id))) {
				return false
			}
			await this.audit.appendSystemJob(tx, bufferCopyDeletionEventOf(copy), now)
			return true
		})
	}
}
