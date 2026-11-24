import { HttpStatus, Injectable } from '@nestjs/common';

import { userNotFound } from '../access/access-errors.js';
import { AuditLogService } from '../audit/audit-log.service.js';
import { isUniqueViolation } from '../database/prisma-errors.js';
import { PrismaService } from '../database/prisma.service.js';
import { AppException } from '../errors/app.exception.js';
import { SellerMemberRole } from '../generated/prisma/enums.js';
import type { SellerTeamMember } from './seller-members.dto.js';

const memberInclude = { user: true } as const;

interface MemberWithUser {
  readonly userId: string;
  readonly role: SellerMemberRole;
  readonly user: {
    readonly email: string;
    readonly firstName: string | null;
    readonly lastName: string | null;
  };
}

function toSellerTeamMember(member: MemberWithUser): SellerTeamMember {
  return {
    userId: member.userId,
    email: member.user.email,
    firstName: member.user.firstName,
    lastName: member.user.lastName,
    role: member.role,
  };
}

/** The people who work for a seller: the owner and the staff. */
@Injectable()
export class SellerMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(sellerId: string): Promise<SellerTeamMember[]> {
    const members = await this.prisma.sellerMember.findMany({
      where: { sellerId },
      include: memberInclude,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    return members.map(toSellerTeamMember);
  }

  /** Adds a person who already has an account to the seller's staff. */
  async addStaff(actorId: string, sellerId: string, email: string): Promise<SellerTeamMember> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw userNotFound();
    }

    try {
      const member = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.sellerMember.create({
          data: { sellerId, userId: user.id, role: SellerMemberRole.STAFF },
          include: memberInclude,
        });

        await this.audit.record(
          {
            action: 'seller.staff_added',
            actorId,
            target: { type: 'user', id: user.id },
            details: { sellerId },
          },
          transaction,
        );

        return created;
      });

      return toSellerTeamMember(member);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException(
          HttpStatus.CONFLICT,
          'ALREADY_SELLER_MEMBER',
          'This person already works for the seller',
          undefined,
          { cause: error },
        );
      }

      throw error;
    }
  }

  /** Removes a person from the staff. The owner stays. */
  async removeStaff(actorId: string, sellerId: string, userId: string): Promise<void> {
    const removed = await this.prisma.$transaction(async (transaction) => {
      const { count } = await transaction.sellerMember.deleteMany({
        where: { sellerId, userId, role: SellerMemberRole.STAFF },
      });

      if (count === 1) {
        await this.audit.record(
          {
            action: 'seller.staff_removed',
            actorId,
            target: { type: 'user', id: userId },
            details: { sellerId },
          },
          transaction,
        );
      }

      return count === 1;
    });

    if (removed) {
      return;
    }

    const member = await this.prisma.sellerMember.findUnique({
      where: { sellerId_userId: { sellerId, userId } },
    });

    if (member) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'SELLER_OWNER_CANNOT_BE_REMOVED',
        'The owner cannot be removed from the seller',
      );
    }
  }
}
