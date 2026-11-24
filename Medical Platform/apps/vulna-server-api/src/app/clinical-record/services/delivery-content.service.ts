import type { ClinicalDelivery } from "@ansora/vulna-domain"
import { Injectable, Logger } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { FHIR_RESOURCE_TYPE, LOCAL_KIND, READ_ONLY_SNAPSHOT } from "../constants/clinical-record.constants"
import { DeliveredInstanceRepository } from "../repositories/delivered-instance.repository"
import { FhirResourceLinkRepository } from "../repositories/fhir-resource-link.repository"
import { deliveryOf } from "../utils/delivery-content"

// CAP-021-R28, backend.md 3 T4, datovy-model.md 13.2
@Injectable()
export class DeliveryContentService {
	private readonly logger = new Logger(DeliveryContentService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly deliveries: DeliveredInstanceRepository,
		private readonly links: FhirResourceLinkRepository,
	) {}

	async contentOf(acquisitionId: string): Promise<ClinicalDelivery | undefined> {
		return await this.database.sql.begin(READ_ONLY_SNAPSHOT, async (tx) => {
			const record = await this.deliveries.recordOf(tx, acquisitionId)
			if (record === undefined) {
				this.logger.error(`The record ${acquisitionId} does not exist`)
				return undefined
			}
			const delivery = deliveryOf(record, await this.deliveries.confirmedInSeriesOf(tx, record))
			if (delivery === undefined) {
				this.logger.error(`The record ${acquisitionId} has no instance the archive confirmed`)
			}
			return delivery
		})
	}

	// datovy-model.md 13.2
	async remember(acquisitionId: string, studyResourceId: string): Promise<void> {
		await this.database.sql.begin(async (tx) => {
			const record = await this.deliveries.recordOf(tx, acquisitionId)
			if (record === undefined) {
				return
			}
			await this.links.upsert(tx, [
				{
					resourceType: FHIR_RESOURCE_TYPE.IMAGING_STUDY,
					localKind: LOCAL_KIND.IMAGING_STUDY,
					localId: record.encounter_id,
					resourceId: studyResourceId,
				},
			])
		})
	}
}
