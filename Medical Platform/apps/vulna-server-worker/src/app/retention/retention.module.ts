import { Module } from "@nestjs/common"
import { DependencyStateModule } from "../../libs/dependency-state/dependency-state.module"
import { RetentionRepository } from "./repositories/retention.repository"
import { BinaryRemovalService } from "./services/binary-removal.service"
import { BufferCleanupService } from "./services/buffer-cleanup.service"
import { RetentionScheduler } from "./services/retention-scheduler.service"
import { StoreRetentionService } from "./services/store-retention.service"

// CAP-026-R11, CAP-026-R18, CAP-026-R19, CAP-026-R20
@Module({
	imports: [DependencyStateModule],
	providers: [
		RetentionRepository,
		BinaryRemovalService,
		BufferCleanupService,
		StoreRetentionService,
		RetentionScheduler,
	],
})
export class RetentionModule {}
