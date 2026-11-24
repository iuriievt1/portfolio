import { HttpStatus, Injectable } from '@nestjs/common';

import { userNotFound } from '../access/access-errors.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { AppException } from '../errors/app.exception.js';
import { PlatformRole } from '../generated/prisma/enums.js';
import type { TeamMember } from './team.dto.js';

const memberInclude = { platformRoles: { orderBy: { role: 'asc' } } } as const;

interface UserWithRoles {
  readonly id: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly platformRoles: readonly { readonly role: PlatformRole }[];
}

function toTeamMember(user: UserWithRoles): TeamMember {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.platformRoles.map(({ role }) => role),
  };
}

/** The Bluberi team: users who have at least one platform role. */
@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(): Promise<TeamMember[]> {
    const users = await this.prisma.user.findMany({
      where: { platformRoles: { some: {} } },
      include: memberInclude,
      orderBy: { email: 'asc' },
    });

    return users.map(toTeamMember);
  }

  /**
   * Gives a role to a person who already has an account. Giving the same role twice changes nothing.
   * The actor is the owner who gives the role, or null when it is given from the command line.
   */
  async grantRole(actorId: string | null, email: string, role: PlatformRole): Promise<TeamMember> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw userNotFound();
    }

    await this.prisma.$transaction(async (transaction) => {
      const { count } = await transaction.userPlatformRole.createMany({
        data: [{ userId: user.id, role }],
        skipDuplicates: true,
      });

      if (count === 1) {
        await this.audit.record(
          {
            action: 'team.role_granted',
            actorId,
            target: { type: 'user', id: user.id },
            details: { role },
          },
          transaction,
        );
      }
    });

    return toTeamMember(
      await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: memberInclude }),
    );
  }

  /** Takes a role away. The platform always keeps at least one owner. */
  async revokeRole(actorId: string, userId: string, role: PlatformRole): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      if (role === PlatformRole.OWNER) {
        // Locks the owner rows, so two owners cannot remove each other at the same moment.
        const owners = await transaction.$queryRaw<{ user_id: string }[]>`
          SELECT user_id FROM user_platform_roles WHERE role = 'OWNER' FOR UPDATE
        `;

        if (owners.length === 1 && owners[0]?.user_id === userId) {
          throw new AppException(
            HttpStatus.CONFLICT,
            'LAST_OWNER',
            'The platform needs at least one owner',
          );
        }
      }

      const { count } = await transaction.userPlatformRole.deleteMany({ where: { userId, role } });

      if (count === 1) {
        await this.audit.record(
          {
            action: 'team.role_revoked',
            actorId,
            target: { type: 'user', id: userId },
            details: { role },
          },
          transaction,
        );
      }
    });
  }

  /** For the command line: makes a person an owner and creates the account when there is none. */
  async addOwner(email: string): Promise<TeamMember> {
    const user = await this.prisma.user.upsert({ where: { email }, create: { email }, update: {} });

    return this.grantRole(null, user.email, PlatformRole.OWNER);
  }
}
