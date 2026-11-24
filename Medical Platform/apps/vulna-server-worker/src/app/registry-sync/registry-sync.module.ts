import { DicomDimseAdapter } from "@ansora/vulna-adapter-dicom-dimse"
import { Module } from "@nestjs/common"
import { PacsModule } from "../../libs/pacs/pacs.module"
import { REGISTRY_SOURCE_FACTORY } from "./constants/registry-sync.constants"
import { RegistryCacheRepository } from "./repositories/registry-cache.repository"
import { SyncLockRepository } from "./repositories/sync-lock.repository"
import { SyncRunRepository } from "./repositories/sync-run.repository"
import { RegistrySourceService } from "./services/registry-source.service"
import { RegistrySyncService } from "./services/registry-sync.service"
import { RegistrySyncScheduler } from "./services/registry-sync-scheduler.service"
import { RegistrySyncSettingsService } from "./services/registry-sync-settings.service"
import type { RegistrySourceFactory } from "./types/registry-sync.types"

// ADR-035 bod 2
const dimseSource: RegistrySourceFactory = (settings) => new DicomDimseAdapter(settings)

// CAP-024
@Module({
	imports: [PacsModule],
	providers: [
		RegistryCacheRepository,
		SyncLockRepository,
		SyncRunRepository,
		RegistrySyncSettingsService,
		RegistrySourceService,
		RegistrySyncService,
		RegistrySyncScheduler,
		{ provide: REGISTRY_SOURCE_FACTORY, useValue: dimseSource },
	],
})
export class RegistrySyncModule {}
