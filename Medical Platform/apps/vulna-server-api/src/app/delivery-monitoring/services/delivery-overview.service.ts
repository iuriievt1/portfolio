import { ADMINISTRATION_ERROR_CODE } from "@ansora/contracts"
import { HttpStatus, Injectable } from "@nestjs/common"
import { DatabaseService, type Executor } from "../../../libs/database/database.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import { CONSISTENT_READ } from "../constants/delivery-monitoring.constants"
import type { DeliveryPageInput } from "../dto/delivery-page.input.dto"
import { DeliveryOverviewRepository } from "../repositories/delivery-overview.repository"
import type { DeliveriesPageView, DeliveryTargetView, DeliveryView } from "../types/delivery-monitoring.types"
import { deliveryTargetViewOf, deliveryViewOf, deliveryViewsOf } from "../utils/delivery-view"

// CAP-028-R12, NAB-345, administration.yaml listDeliveries, getDelivery, listDeliveryTargets
@Injectable()
export class DeliveryOverviewService {
	constructor(
		private readonly database: DatabaseService,
		private readonly deliveries: DeliveryOverviewRepository,
		private readonly configuration: ConfigurationService,
	) {}

	async list(query: DeliveryPageInput): Promise<DeliveriesPageView> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		return await this.database.sql.begin(CONSISTENT_READ, async (tx) => {
			const page = await this.deliveries.page(tx, {
				limit,
				cursor: query.cursor,
				state: query.state,
				instanceState: query.instance_state,
			})
			const instances = await this.deliveries.instancesOf(
				tx,
				page.rows.map((row) => row.id),
			)
			return { items: deliveryViewsOf(page.rows, instances), next_cursor: page.nextCursor }
		})
	}

	async detail(deliveryId: string): Promise<DeliveryView> {
		return await this.database.sql.begin(CONSISTENT_READ, async (tx) => await this.detailWithin(tx, deliveryId))
	}

	async detailWithin(sql: Executor, deliveryId: string): Promise<DeliveryView> {
		const delivery = await this.deliveries.find(sql, deliveryId)
		if (delivery === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
		return deliveryViewOf(delivery, await this.deliveries.instancesOf(sql, [delivery.id]))
	}

	// CAP-023-R23, CAP-023-R24, CAP-023-R27
	async targets(): Promise<DeliveryTargetView[]> {
		return (await this.deliveries.targets()).map(deliveryTargetViewOf)
	}
}
