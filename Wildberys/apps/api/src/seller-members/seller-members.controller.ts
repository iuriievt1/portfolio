import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RequireSellerRole } from '../access/access.decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SellerMemberRole } from '../generated/prisma/enums.js';
import {
  AddSellerStaffBody,
  SellerMemberParams,
  SellerParams,
  SellerTeamMember,
} from './seller-members.dto.js';
import { SellerMembersService } from './seller-members.service.js';

@ApiTags('Seller: members')
@Controller('sellers/:sellerId/members')
@RequireSellerRole([SellerMemberRole.OWNER])
export class SellerMembersController {
  constructor(private readonly members: SellerMembersService) {}

  @Get()
  @ApiOperation({ summary: 'People who work for the seller' })
  @ApiOkResponse({ type: [SellerTeamMember] })
  list(@Param() params: SellerParams): Promise<SellerTeamMember[]> {
    return this.members.list(params.sellerId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a person who already has an account to the staff' })
  @ApiCreatedResponse({ type: SellerTeamMember })
  addStaff(
    @CurrentAuth() auth: AuthContext,
    @Param() params: SellerParams,
    @Body() body: AddSellerStaffBody,
  ): Promise<SellerTeamMember> {
    return this.members.addStaff(auth.userId, params.sellerId, body.email);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a person from the staff. The owner cannot be removed' })
  @ApiNoContentResponse({ description: 'The person no longer works for the seller' })
  removeStaff(
    @CurrentAuth() auth: AuthContext,
    @Param() params: SellerMemberParams,
  ): Promise<void> {
    return this.members.removeStaff(auth.userId, params.sellerId, params.userId);
  }
}
