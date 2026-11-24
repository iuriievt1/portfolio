import { PERMISSION } from "@ansora/core-server"
import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	UseGuards,
} from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { type PageInput, pageSchema } from "../../infra/dto/page.input.dto"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import {
	ORPHANED_OBJECT_DELETION_SUBPATH,
	ORPHANED_OBJECT_ID_PARAMETER,
	ORPHANED_OBJECTS_PATH,
} from "../constants/orphaned-object.constants"
import {
	type OrphanedObjectDeletionInput,
	orphanedObjectDeletionSchema,
} from "../dto/orphaned-object-deletion.input.dto"
import { OrphanedObjectService } from "../services/orphaned-object.service"
import type { OrphanedObjectsPageView } from "../types/orphaned-object.types"

// CAP-026-R14, CAP-026-S07, CAP-026-S08, administration.yaml listOrphanedObjects, deleteOrphanedObject
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(ORPHANED_OBJECTS_PATH)
export class OrphanedObjectController {
	constructor(private readonly orphans: OrphanedObjectService) {}

	// NAB-344, NAB-398
	@Get()
	@RequiresPermission(PERMISSION.ADMINISTRATION_ACCESS)
	async listOrphanedObjects(
		@Query(new ZodValidationPipe(pageSchema)) query: PageInput,
	): Promise<OrphanedObjectsPageView> {
		return await this.orphans.list(query)
	}

	// NAB-344, NAB-438, CAP-026-S08
	@Post(ORPHANED_OBJECT_DELETION_SUBPATH)
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequiresPermission(PERMISSION.MONITORING_MANAGE)
	async deleteOrphanedObject(
		@Param(ORPHANED_OBJECT_ID_PARAMETER, ParseUUIDPipe) objectId: string,
		@Body(new ZodValidationPipe(orphanedObjectDeletionSchema)) deletion: OrphanedObjectDeletionInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<void> {
		await this.orphans.delete(objectId, deletion, administrator)
	}
}
