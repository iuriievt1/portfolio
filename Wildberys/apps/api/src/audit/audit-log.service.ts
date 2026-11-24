import { Injectable } from '@nestjs/common';

import type { DatabaseClient } from '../database/database-client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { toPage } from '../pagination/page.js';
import { auditActions, type AuditAction, type AuditEvent } from './audit-events.js';
import type { AuditLogPage, AuditLogPerson, AuditLogQuery } from './audit-log.dto.js';

interface PersonRow {
  readonly id: string;
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
}

function toPerson(user: PersonRow): AuditLogPerson {
  return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
}

/** The column is plain text. Only this service writes it, so an unknown value means a bug. */
function toAuditAction(action: string): AuditAction {
  const known = auditActions.find((candidate) => candidate === action);

  if (!known) {
    throw new Error(`The audit log holds an action the code does not know: ${action}`);
  }

  return known;
}

function toDetails(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

/** The audit log: who did what and when. Entries are only added. */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Writes an entry. Pass the transaction of the change itself,
   * so the change and its entry are saved together or not at all.
   */
  async record(event: AuditEvent, database: DatabaseClient): Promise<void> {
    await database.auditLogEntry.create({
      data: {
        action: event.action,
        actorId: event.actorId,
        targetType: 'target' in event ? event.target.type : null,
        targetId: 'target' in event ? event.target.id : null,
        details: 'details' in event ? event.details : {},
      },
    });
  }

  /** One page of the log, newest first. */
  async list({ limit, cursor, actorId, action }: AuditLogQuery): Promise<AuditLogPage> {
    // Ids are UUID v7, so sorting by id is sorting by time.
    const rows = await this.prisma.auditLogEntry.findMany({
      where: { actorId, action, id: cursor ? { lt: cursor } : undefined },
      orderBy: { id: 'desc' },
      take: limit + 1,
      include: { actor: true },
    });
    const { items, nextCursor } = toPage(rows, limit);
    const targetUserIds = items.flatMap((entry) =>
      entry.targetType === 'user' && entry.targetId ? [entry.targetId] : [],
    );
    const targetUsers = await this.prisma.user.findMany({ where: { id: { in: targetUserIds } } });
    const targetUserById = new Map(targetUsers.map((user) => [user.id, toPerson(user)]));

    return {
      items: items.map((entry) => ({
        id: entry.id,
        action: toAuditAction(entry.action),
        createdAt: entry.createdAt,
        actor: entry.actor ? toPerson(entry.actor) : null,
        targetUser: entry.targetId ? (targetUserById.get(entry.targetId) ?? null) : null,
        details: toDetails(entry.details),
      })),
      nextCursor,
    };
  }
}
