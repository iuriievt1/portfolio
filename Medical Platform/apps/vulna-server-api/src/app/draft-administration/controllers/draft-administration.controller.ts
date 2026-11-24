import { PERMISSION } from "@ansora/core-server"
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from "@nestjs/common"
import { RequiresPermission } from "../../administration-session/decorators/requires-permission.decorator"
import type { AdministrationSession } from "../../administration-session/types/administration-session.types"
import { Administrator } from "../../infra/decorators/administrator.decorator"
import { OutsideMobileContract } from "../../infra/decorators/outside-mobile-contract.decorator"
import { AdministrationSessionGuard } from "../../infra/guards/administration-session.guard"
import { ZodValidationPipe } from "../../infra/pipes/zod-validation.pipe"
import { ACQUISITION_DRAFTS_PATH, DISCARD_SUBPATH } from "../constants/draft-administration.constants"
import { type AcquisitionDraftPageInput, acquisitionDraftPageSchema } from "../dto/acquisition-draft-page.input.dto"
import { type DraftDiscardInput, draftDiscardSchema } from "../dto/draft-discard.input.dto"
import { AcquisitionDraftSearchService } from "../services/acquisition-draft-search.service"
import { DraftDiscardConsentService } from "../services/draft-discard-consent.service"
import type { AdministeredDraftsPageView, DraftDiscardResultView } from "../types/draft-administration.types"

// CAP-004-R14, CAP-015-R19, CAP-015-R20
@OutsideMobileContract()
@UseGuards(AdministrationSessionGuard)
@Controller(ACQUISITION_DRAFTS_PATH)
export class DraftAdministrationController {
	constructor(
		private readonly searches: AcquisitionDraftSearchService,
		private readonly consents: DraftDiscardConsentService,
	) {}

	@Get()
	@RequiresPermission(PERMISSION.DRAFTS_MANAGE)
	async searchAcquisitionDrafts(
		@Query(new ZodValidationPipe(acquisitionDraftPageSchema)) query: AcquisitionDraftPageInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<AdministeredDraftsPageView> {
		return await this.searches.search(administrator, query, new Date())
	}

	// CAP-015-S18, CAP-015-S20
	@Post(DISCARD_SUBPATH)
	@HttpCode(HttpStatus.OK)
	@RequiresPermission(PERMISSION.DRAFTS_MANAGE)
	async discardAcquisitionDraftsWithConsent(
		@Body(new ZodValidationPipe(draftDiscardSchema)) input: DraftDiscardInput,
		@Administrator() administrator: AdministrationSession,
	): Promise<DraftDiscardResultView> {
		return await this.consents.grant(
			administrator,
			{
				operatorUserId: input.operator_user_id,
				reason: input.reason,
				selections: input.acquisitions.map((selection) => ({
					acquisitionId: selection.acquisition_id,
					seenUpdatedAt: selection.seen_updated_at,
				})),
			},
			new Date(),
		)
	}
}
