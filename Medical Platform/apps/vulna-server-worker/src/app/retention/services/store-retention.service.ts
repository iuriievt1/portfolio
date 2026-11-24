import {
	CONFIGURATION_KEY,
	type DurableBinaryRemovalPort,
	integerValueOf,
	requiredIntegerOf,
} from "@ansora/core-server"
import { isClinicalRecordUnavailability } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { AuditRepository } from "../../../libs/audit/audit.repository"
import { ConfigurationService } from "../../../libs/configuration/configuration.service"
import { DatabaseService } from "../../../libs/database/database.service"
import { REMOVAL } from "../constants/retention.constants"
import { RetentionRepository } from "../repositories/retention.repository"
import type { Removal, RetainedFileRow, RetentionPeriods, StoreRetentionRun } from "../types/retention.types"
import { retentionDeletionEventOf } from "../utils/retention-audit"
import { BinaryRemovalService } from "./binary-removal.service"

// CAP-026-R19, CAP-026-R20, dorucovaci-jadro.md 6, backend.md 3.1 T8, ADR-050 bod 14
@Injectable()
export class StoreRetentionService {
	private readonly logger = new Logger(StoreRetentionService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly configuration: ConfigurationService,
		private readonly retention: RetentionRepository,
		private readonly audit: AuditRepository,
		private readonly removals: BinaryRemovalService,
	) {}

	async run(now: Date): Promise<StoreRetentionRun> {
		const removal = await this.removals.current()
		if (removal === undefined) {
			return { requestedCount: 0, removedCount: 0 }
		}
		const requestedCount = await this.requestDetaching(await this.periods())
		const removedCount = await this.removeDetached(removal, now)
		return { requestedCount, removedCount }
	}

	// CAP-026-R01, CAP-026-R02, CAP-026-R20, CAP-012-R30
	private async periods(): Promise<RetentionPeriods> {
		const values = await this.configuration.effectiveValues()
		return {
			originalDays: requiredIntegerOf(values, CONFIGURATION_KEY.RETENTION_FULL_IMAGES_DAYS),
			thumbnailDays: integerValueOf(values, CONFIGURATION_KEY.RETENTION_THUMBNAILS_DAYS),
			viewingCopyDays: integerValueOf(values, CONFIGURATION_KEY.VIEWING_COPY_RETENTION_DAYS),
		}
	}

	private async requestDetaching(periods: RetentionPeriods): Promise<number> {
		let requestedCount = 0
		for (const file of await this.retention.dueFiles(periods)) {
			const isRequested = await this.database.sql.begin(async (tx) => {
				if (!(await this.retention.markDue(tx, file.binary_object_id))) {
					return false
				}
				await this.retention.requestResourceWrite(tx, file)
				return true
			})
			if (isRequested) {
				requestedCount++
			}
		}
		return requestedCount
	}

	private async removeDetached(removal: DurableBinaryRemovalPort, now: Date): Promise<number> {
		let removedCount = 0
		const files = await this.retention.detachedFiles()
		for (const file of files) {
			const outcome = await this.removed(removal, file, now)
			if (outcome === REMOVAL.STORE_UNAVAILABLE) {
				break
			}
			if (outcome === REMOVAL.DONE) {
				removedCount++
			}
		}
		return removedCount
	}

	private async removed(removal: DurableBinaryRemovalPort, file: RetainedFileRow, now: Date): Promise<Removal> {
		try {
			await removal.removeWithVersions(file.clinical_record_binary_id)
		} catch (error) {
			this.logger.error(
				`Removing binary ${file.clinical_record_binary_id} of ${file.file_kind} ${file.file_id} failed`,
				error,
			)
			return isClinicalRecordUnavailability(error) ? REMOVAL.STORE_UNAVAILABLE : REMOVAL.SKIPPED
		}
		return (await this.forget(file, now)) ? REMOVAL.DONE : REMOVAL.SKIPPED
	}

	private async forget(file: RetainedFileRow, now: Date): Promise<boolean> {
		return await this.database.sql.begin(async (tx) => {
			if (!(await this.retention.lockDetached(tx, file.binary_object_id))) {
				return false
			}
			await this.retention.forget(tx, file)
			await this.audit.appendSystemJob(tx, retentionDeletionEventOf(file), now)
			return true
		})
	}
}
