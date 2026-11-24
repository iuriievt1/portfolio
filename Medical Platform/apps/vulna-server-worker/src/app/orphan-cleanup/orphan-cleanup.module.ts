import { Module } from "@nestjs/common"
import { OrphanAlertRepository } from "./repositories/orphan-alert.repository"
import { OrphanedObjectRepository } from "./repositories/orphaned-object.repository"
import { OrphanCleanupService } from "./services/orphan-cleanup.service"
import { OrphanCleanupScheduler } from "./services/orphan-cleanup-scheduler.service"
import { UnrecordedBinaryService } from "./services/unrecorded-binary.service"

// CAP-026-R14, dorucovaci-jadro.md 2
@Module({
	providers: [
		OrphanedObjectRepository,
		OrphanAlertRepository,
		UnrecordedBinaryService,
		OrphanCleanupService,
		OrphanCleanupScheduler,
	],
})
export class OrphanCleanupModule {}
