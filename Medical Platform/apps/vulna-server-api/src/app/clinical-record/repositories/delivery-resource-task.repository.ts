import { JOB_OBJECT_KIND } from "@ansora/core-server"
import { Injectable } from "@nestjs/common"
import { DatabaseService } from "../../../libs/database/database.service"
import { AuditRepository } from "../../audit/repositories/audit.repository"
import { AdministratorAlertRepository } from "../../monitoring/repositories/administrator-alert.repository"
import { WriteTaskRepository } from "./write-task.repository"

// CAP-021-R28, backend.md 3 T4, datovy-model.md 4
@Injectable()
export class DeliveryResourceTaskRepository extends WriteTaskRepository {
	constructor(database: DatabaseService, alerts: AdministratorAlertRepository, audit: AuditRepository) {
		super(database, alerts, audit, JOB_OBJECT_KIND.ACQUISITION)
	}
}
