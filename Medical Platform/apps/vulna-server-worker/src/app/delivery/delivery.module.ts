import { DicomDimseAdapter } from "@ansora/vulna-adapter-dicom-dimse"
import { Module } from "@nestjs/common"
import { PacsModule } from "../../libs/pacs/pacs.module"
import { DELIVERY_ARCHIVE_FACTORY } from "./constants/delivery.constants"
import { DeliveryAlertRepository } from "./repositories/delivery-alert.repository"
import { DeliveryInstanceRepository } from "./repositories/delivery-instance.repository"
import { DeliveryTargetRepository } from "./repositories/delivery-target.repository"
import { DeliveryService } from "./services/delivery.service"
import { DeliveryRecorderService } from "./services/delivery-recorder.service"
import { DeliverySettingsService } from "./services/delivery-settings.service"
import { InstanceDeliveryService } from "./services/instance-delivery.service"
import { TargetWatchService } from "./services/target-watch.service"
import type { DeliveryArchiveFactory } from "./types/delivery.types"

// ADR-003 ř. 28, ADR-005 ř. 38–39
const dimseArchive: DeliveryArchiveFactory = (settings) => new DicomDimseAdapter(settings)

// CAP-023, dorucovaci-jadro.md 4, 5
@Module({
	imports: [PacsModule],
	providers: [
		DeliveryInstanceRepository,
		DeliveryTargetRepository,
		DeliveryAlertRepository,
		DeliverySettingsService,
		DeliveryRecorderService,
		InstanceDeliveryService,
		TargetWatchService,
		DeliveryService,
		{ provide: DELIVERY_ARCHIVE_FACTORY, useValue: dimseArchive },
	],
})
export class DeliveryModule {}
