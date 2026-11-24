import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { PERMISSION } from "@ansora/core-server"
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Res,
	UseGuards,
} from "@nestjs/common"
import type { Response } from "express"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import {
	AUDIT_BASE_PATH,
	AUDIT_ROUTE,
	CSV_CONTENT_TYPE,
	EXPORT_ID_PARAMETER,
} from "../constants/audit-administration.constants"
import { type AuditExportInput, auditExportSchema } from "../dto/audit-export.input.dto"
import { type AuditSearchInput, auditSearchSchema } from "../dto/audit-search.input.dto"
import { AuditAdministrationService } from "../services/audit-administration.service"
import type {
	AuditChainCheckView,
	AuditExportStatusView,
	AuditExportView,
	AuditRecordsPage,
} from "../types/audit-administration.types"

// CAP-025-R07, CAP-003-R02
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(AUDIT_BASE_PATH)
export class AuditAdministrationController {
	private readonly logger = new Logger(AuditAdministrationController.name)

	constructor(private readonly audit: AuditAdministrationService) {}

	@Get()
	@RequiresPermission(PERMISSION.AUDIT_READ)
	async search(@Query(new ZodValidationPipe(auditSearchSchema)) query: AuditSearchInput): Promise<AuditRecordsPage> {
		return await this.audit.search(query)
	}

	@Get(AUDIT_ROUTE.CHAIN_CHECK)
	@RequiresPermission(PERMISSION.AUDIT_READ)
	async verifyChain(@Administrator() administrator: AdministrationSession): Promise<AuditChainCheckView> {
		return await this.audit.verifyChain(administrator)
	}

	@Get(AUDIT_ROUTE.EXPORT_STATUS)
	@RequiresPermission(PERMISSION.AUDIT_READ)
	async exportStatus(): Promise<AuditExportStatusView> {
		return await this.audit.exportStatus()
	}

	@Post(AUDIT_ROUTE.EXPORT)
	@HttpCode(HttpStatus.ACCEPTED)
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async requestExport(
		@Body(new ZodValidationPipe(auditExportSchema)) body: AuditExportInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<AuditExportView> {
		return await this.audit.requestExport(body, administrator)
	}

	@Get(AUDIT_ROUTE.EXPORT_FILE)
	@RequiresPermission(PERMISSION.AUDIT_EXPORT)
	async exportFile(
		@Param(EXPORT_ID_PARAMETER, ParseUUIDPipe) exportId: string,
		@Administrator() administrator: AdministrationSession,
		@Res() response: Response,
	): Promise<void> {
		const file = await this.audit.exportFile(exportId, administrator)
		response.setHeader("Content-Type", CSV_CONTENT_TYPE)
		response.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`)
		try {
			await pipeline(Readable.from(file.lines), response)
		} catch (error) {
			this.logger.error(`Streaming audit export ${exportId} failed`, error)
			response.destroy()
		}
	}
}
