import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePlatformAccess } from '../access/access.decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import {
  DecisionBody,
  ModeratedSeller,
  ModeratedSellersPage,
  SellerCounts,
  SellerDocumentParams,
  SellerParams,
  SellerRegisterCheck,
  SellersQuery,
} from './seller-moderation.dto.js';
import { SellerModerationService } from './seller-moderation.service.js';

const card = { type: ModeratedSeller, description: 'The seller after the decision' };

/**
 * The check of sellers in the admin. Everyone who may look at sellers reads the lists and the cards.
 * A decision needs full access to the section.
 */
@ApiTags('Admin: sellers')
@Controller('admin/sellers')
@RequirePlatformAccess({ area: 'sellers', level: 'view' })
export class SellerModerationController {
  constructor(private readonly moderation: SellerModerationService) {}

  @Get()
  @ApiOperation({
    summary: 'Sellers in one status',
    description:
      'Sellers who wait for the team come oldest first, by the time they were sent. The others come newest first.',
  })
  @ApiOkResponse({ type: ModeratedSellersPage })
  list(@Query() query: SellersQuery): Promise<ModeratedSellersPage> {
    return this.moderation.list(query);
  }

  @Get('counts')
  @ApiOperation({ summary: 'How many sellers are in each status' })
  @ApiOkResponse({ type: SellerCounts })
  counts(): Promise<SellerCounts> {
    return this.moderation.counts();
  }

  @Get(':sellerId')
  @ApiOperation({ summary: 'Everything the team decides about a seller by' })
  @ApiOkResponse({ type: ModeratedSeller })
  find(@Param() { sellerId }: SellerParams): Promise<ModeratedSeller> {
    return this.moderation.find(sellerId);
  }

  @Get(':sellerId/register-check')
  @ApiOperation({
    summary: 'What the public registers say about the company now',
    description:
      'A Czech company is compared with the company register ARES and comes with its trade licences. ' +
      'A company from another EU country is checked by its VAT number in VIES.',
  })
  @ApiOkResponse({ type: SellerRegisterCheck })
  registerCheck(@Param() { sellerId }: SellerParams): Promise<SellerRegisterCheck> {
    return this.moderation.registerCheck(sellerId);
  }

  @Get(':sellerId/documents/:documentId')
  // A document is shown by the admin only, never kept by a browser or by anything between.
  @Header('cache-control', 'private, no-store')
  @Header('x-content-type-options', 'nosniff')
  @ApiOperation({
    summary: 'Open a document of a seller',
    description:
      'The file itself: a PDF, a JPEG or a PNG. Every opening is written to the audit log.',
  })
  @ApiProduces('application/pdf', 'image/jpeg', 'image/png')
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async openDocument(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId, documentId }: SellerDocumentParams,
  ): Promise<StreamableFile> {
    const { body, contentType, fileName } = await this.moderation.openDocument(
      sellerId,
      documentId,
      auth.userId,
    );

    return new StreamableFile(body, {
      type: contentType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      length: body.length,
    });
  }

  @Post(':sellerId/approval')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformAccess({ area: 'sellers', level: 'full' })
  @ApiOperation({
    summary: 'Approve a seller',
    description:
      'For a seller in the check. The store of the seller opens, and the seller gets an email.',
  })
  @ApiOkResponse(card)
  approve(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerParams,
  ): Promise<ModeratedSeller> {
    return this.moderation.approve(auth.userId, sellerId);
  }

  @Post(':sellerId/document-request')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformAccess({ area: 'sellers', level: 'full' })
  @ApiOperation({
    summary: 'Ask a seller for documents',
    description:
      'For a seller in the check. The seller gets the message by email, adds the documents in the portal and sends the registration again.',
  })
  @ApiOkResponse(card)
  requestDocuments(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerParams,
    @Body() { message }: DecisionBody,
  ): Promise<ModeratedSeller> {
    return this.moderation.requestDocuments(auth.userId, sellerId, message);
  }

  @Post(':sellerId/rejection')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformAccess({ area: 'sellers', level: 'full' })
  @ApiOperation({
    summary: 'Refuse a seller',
    description:
      'For a seller in the check or one the team waits for documents from. The seller gets the reason by email.',
  })
  @ApiOkResponse(card)
  reject(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerParams,
    @Body() { message }: DecisionBody,
  ): Promise<ModeratedSeller> {
    return this.moderation.reject(auth.userId, sellerId, message);
  }

  @Post(':sellerId/reopening')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformAccess({ area: 'sellers', level: 'full' })
  @ApiOperation({
    summary: 'Take a refused seller back into the check',
    description: 'For example after the seller objected to the refusal.',
  })
  @ApiOkResponse(card)
  reopen(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerParams,
  ): Promise<ModeratedSeller> {
    return this.moderation.reopen(auth.userId, sellerId);
  }

  @Delete(':sellerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePlatformAccess({ area: 'sellers', level: 'full' })
  @ApiOperation({
    summary: 'Delete a registration that was not sent',
    description:
      'With its store, its documents and its payout account. The company number becomes free for another registration.',
  })
  @ApiNoContentResponse({ description: 'The registration is deleted' })
  removeDraft(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerParams,
  ): Promise<void> {
    return this.moderation.removeDraft(auth.userId, sellerId);
  }
}
