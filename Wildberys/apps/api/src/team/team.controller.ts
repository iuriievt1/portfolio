import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePlatformAccess } from '../access/access.decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { GrantTeamRoleBody, TeamMember, TeamRoleParams } from './team.dto.js';
import { TeamService } from './team.service.js';

@ApiTags('Admin: team')
@Controller('admin/team')
@RequirePlatformAccess({ area: 'roles', level: 'full' })
export class TeamController {
  constructor(private readonly team: TeamService) {}

  @Get()
  @RequirePlatformAccess({ area: 'roles', level: 'view' })
  @ApiOperation({ summary: 'People in the Bluberi team and their roles' })
  @ApiOkResponse({ type: [TeamMember] })
  list(): Promise<TeamMember[]> {
    return this.team.list();
  }

  @Post('roles')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Give a team role to a person who already has an account' })
  @ApiOkResponse({ type: TeamMember, description: 'The person with all their roles' })
  grantRole(
    @CurrentAuth() auth: AuthContext,
    @Body() body: GrantTeamRoleBody,
  ): Promise<TeamMember> {
    return this.team.grantRole(auth.userId, body.email, body.role);
  }

  @Delete(':userId/roles/:role')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Take a team role away. The last owner cannot be removed' })
  @ApiNoContentResponse({ description: 'The person no longer has the role' })
  revokeRole(@CurrentAuth() auth: AuthContext, @Param() params: TeamRoleParams): Promise<void> {
    return this.team.revokeRole(auth.userId, params.userId, params.role);
  }
}
