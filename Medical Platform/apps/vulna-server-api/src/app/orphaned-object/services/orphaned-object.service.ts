import { ADMINISTRATION_ERROR_CODE, ADMINISTRATOR_ALERT_KIND } from "@ansora/contracts"
import { HttpStatus, Injectable, Logger } from "@nestjs/common"
import type postgres from "@veevoy/postgres"
import { DatabaseService } from "../../../libs/database/database.service"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { BinaryObjectService } from "../../binary-object/services/binary-object.service"
import { ConfigurationService } from "../../configuration/services/configuration.service"
import type { PageInput } from "../../infra/dto/page.input.dto"
import { ProblemException } from "../../infra/exceptions/problem.exception"
import { pageLimit } from "../../infra/utils/page-limit"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import type { OrphanedObjectDeletionInput } from "../dto/orphaned-object-deletion.input.dto"
import { OrphanedObjectRepository } from "../repositories/orphaned-object.repository"
import type { OrphanedObjectDeletion, OrphanedObjectsPageView } from "../types/orphaned-object.types"
import { orphanedObjectDeletionEventOf, orphanedObjectViewOf } from "../utils/orphaned-object-view"

// CAP-026-R14, CAP-026-S07, CAP-026-S08, ADR-038, administration.yaml listOrphanedObjects, deleteOrphanedObject
@Injectable()
export class OrphanedObjectService {
	private readonly logger = new Logger(OrphanedObjectService.name)

	constructor(
		private readonly database: DatabaseService,
		private readonly configuration: ConfigurationService,
		private readonly objects: OrphanedObjectRepository,
		private readonly alerts: AdministratorAlertRepository,
		private readonly audit: AuditRepository,
		private readonly binaries: BinaryObjectService,
	) {}

	async list(query: PageInput): Promise<OrphanedObjectsPageView> {
		const limit = pageLimit(query.limit, await this.configuration.pageSize())
		const page = await this.objects.page({ limit, cursor: query.cursor })
		return { items: page.rows.map(orphanedObjectViewOf), next_cursor: page.nextCursor }
	}

	// CAP-026-S08, dorucovaci-jadro.md 2
	async delete(
		objectId: string,
		input: OrphanedObjectDeletionInput,
		administrator: AdministrationSession,
	): Promise<void> {
		const deletion: OrphanedObjectDeletion = {
			objectId,
			reason: input.reason,
			administratorUserId: administrator.userId,
		}
		await this.database.sql.begin(async (tx: postgres.TransactionSql) => await this.forget(tx, deletion))
		this.logger.log(`Administrator ${deletion.administratorUserId} deleted orphaned binary object ${objectId}`)
		await this.binaries.discardBytes([objectId])
	}

	private async forget(tx: postgres.TransactionSql, deletion: OrphanedObjectDeletion): Promise<void> {
		const object = await this.objects.locked(tx, deletion.objectId)
		if (object === undefined) {
			throw new ProblemException(HttpStatus.NOT_FOUND, ADMINISTRATION_ERROR_CODE.NOT_FOUND)
		}
		if (object.set_aside_at === null || !object.is_unreferenced) {
			throw new ProblemException(HttpStatus.CONFLICT, ADMINISTRATION_ERROR_CODE.ORPHANED_OBJECT_NOT_SET_ASIDE)
		}
		await this.audit.append(tx, orphanedObjectDeletionEventOf(deletion))
		await this.objects.delete(tx, deletion.objectId)
		if (!(await this.objects.isAnySetAside(tx))) {
			await this.alerts.resolveAllOf(tx, ADMINISTRATOR_ALERT_KIND.ORPHANED_OBJECTS_SET_ASIDE)
		}
	}
}
