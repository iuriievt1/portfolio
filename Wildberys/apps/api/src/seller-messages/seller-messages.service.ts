import { Injectable } from '@nestjs/common';

import type { DatabaseClient } from '../database/database-client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { LiveEvents } from '../live-events/live-events.js';
import {
  SellerConversationTopic,
  SellerMessageKind,
  SellerMessageSide,
} from '../generated/prisma/enums.js';
import type { PageQuery } from '../pagination/page-query.js';
import { toPage } from '../pagination/page.js';
import { portalStatuses } from '../sellers/seller-status.js';
import { conversationNotFound, messagesClosed } from './seller-message-errors.js';
import type {
  ConversationsPage,
  ConversationThread,
  OpenedConversation,
  SellerMessageView,
  TeamConversationsPage,
  TeamConversationThread,
} from './seller-messages.dto.js';
import { SellerNotifier } from './seller-notifier.js';

/** How much of the last message a line of an inbox carries. */
const previewLength = 140;

const shownMessage = {
  id: true,
  side: true,
  kind: true,
  body: true,
  createdAt: true,
  readAt: true,
} as const;

const sellerOfConversation = {
  select: {
    id: true,
    legalName: true,
    status: true,
    // The store of the registration: the name buyers and the team know the seller by.
    stores: { orderBy: { createdAt: 'asc' }, take: 1, select: { name: true } },
  },
} satisfies Prisma.SellerDefaultArgs;

/** The side that reads what the given side wrote. */
function otherSide(side: SellerMessageSide): SellerMessageSide {
  return side === SellerMessageSide.TEAM ? SellerMessageSide.SELLER : SellerMessageSide.TEAM;
}

/** What an inbox loads of every conversation: its last message and how much the reader has not opened. */
function rowInclude(reader: SellerMessageSide) {
  return {
    seller: sellerOfConversation,
    messages: { orderBy: { id: 'desc' }, take: 1, select: { side: true, kind: true, body: true } },
    _count: { select: { messages: { where: { side: otherSide(reader), readAt: null } } } },
  } satisfies Prisma.SellerConversationInclude;
}

type ConversationWithRow = Prisma.SellerConversationGetPayload<{
  include: ReturnType<typeof rowInclude>;
}>;

function toRow(conversation: ConversationWithRow) {
  const [last] = conversation.messages;

  return {
    id: conversation.id,
    topic: conversation.topic,
    subject: conversation.subject,
    lastMessageAt: conversation.lastMessageAt,
    lastMessage: {
      side: last?.side ?? SellerMessageSide.TEAM,
      kind: last?.kind ?? SellerMessageKind.TEXT,
      body: (last?.body ?? '').slice(0, previewLength),
    },
    unreadCount: conversation._count.messages,
  };
}

function toSeller({ id, legalName, stores }: ConversationWithRow['seller']) {
  return { id, legalName, storeName: stores[0]?.name ?? null };
}

/** Who opens a conversation, or writes in one. */
export interface Author {
  readonly side: SellerMessageSide;
  readonly userId: string;
}

export interface DecisionMessage {
  readonly sellerId: string;
  /** The member of the team who decided. */
  readonly authorId: string;
  readonly kind: Exclude<SellerMessageKind, 'TEXT'>;
  /** What the seller is told. Empty for an approval. */
  readonly body: string;
}

/**
 * The inbox of a seller and the inbox of the Bluberi team: conversations with a subject, like letters.
 * Either side opens one and both write in it. The decisions of the team about a registration are put
 * into the conversation about the registration, so the seller finds everything Bluberi said in one place.
 * Who may read and write is decided by the caller.
 *
 * A page with an inbox open hears at once that a conversation changed, and reads it again.
 */
@Injectable()
export class SellerMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifier: SellerNotifier,
    private readonly live: LiveEvents,
  ) {}

  /** Tells the open pages of both sides that a conversation changed. For a change that is already saved. */
  changed(sellerId: string, conversationId: string): Promise<void> {
    return this.live.report({ kind: 'conversation-changed', sellerId, conversationId });
  }

  /** The inbox of one seller: the conversation written in last comes first. */
  async inboxOfSeller(sellerId: string, { limit, cursor }: PageQuery): Promise<ConversationsPage> {
    const rows = await this.conversations({ sellerId }, SellerMessageSide.SELLER, limit, cursor);
    const { items, nextCursor } = toPage(rows, limit);

    return { items: items.map(toRow), nextCursor };
  }

  /** The inbox of the team: the conversations with every seller, or with one. */
  async inboxOfTeam(
    { limit, cursor }: PageQuery,
    sellerId?: string,
  ): Promise<TeamConversationsPage> {
    const rows = await this.conversations({ sellerId }, SellerMessageSide.TEAM, limit, cursor);
    const { items, nextCursor } = toPage(rows, limit);

    return {
      items: items.map((conversation) => ({
        ...toRow(conversation),
        seller: toSeller(conversation.seller),
      })),
      nextCursor,
    };
  }

  /** How many messages of the other side the reader has not opened: in every conversation, or of one seller. */
  unreadCount(reader: SellerMessageSide, sellerId?: string): Promise<number> {
    return this.prisma.sellerMessage.count({
      where: { side: otherSide(reader), readAt: null, conversation: { sellerId } },
    });
  }

  /** A conversation as a person of the seller reads it. */
  async threadOfSeller(
    sellerId: string,
    conversationId: string,
    { limit, cursor }: PageQuery,
  ): Promise<ConversationThread> {
    const conversation = await this.find(conversationId, sellerId);
    const rows = await this.prisma.sellerMessage.findMany({
      where: { conversationId, id: cursor ? { lt: cursor } : undefined },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: shownMessage,
    });
    const { items, nextCursor } = toPage(rows, limit);

    return {
      id: conversation.id,
      topic: conversation.topic,
      subject: conversation.subject,
      open: portalStatuses.includes(conversation.seller.status),
      messages: items,
      nextCursor,
    };
  }

  /** The same conversation as the team reads it: with the seller, and with who wrote every message. */
  async threadOfTeam(
    conversationId: string,
    { limit, cursor }: PageQuery,
  ): Promise<TeamConversationThread> {
    const conversation = await this.find(conversationId);
    const rows = await this.prisma.sellerMessage.findMany({
      where: { conversationId, id: cursor ? { lt: cursor } : undefined },
      orderBy: { id: 'desc' },
      take: limit + 1,
      select: { ...shownMessage, author: { select: { email: true } } },
    });
    const { items, nextCursor } = toPage(rows, limit);

    return {
      id: conversation.id,
      topic: conversation.topic,
      subject: conversation.subject,
      open: portalStatuses.includes(conversation.seller.status),
      seller: toSeller(conversation.seller),
      messages: items.map(({ author, ...message }) => ({ ...message, authorEmail: author.email })),
      nextCursor,
    };
  }

  /** Opens a conversation under a subject, with its first message. */
  async open(
    sellerId: string,
    author: Author,
    subject: string,
    body: string,
  ): Promise<OpenedConversation> {
    const seller = await this.prisma.seller.findUnique({
      where: { id: sellerId },
      select: { status: true },
    });

    if (!seller) {
      throw conversationNotFound();
    }

    if (!portalStatuses.includes(seller.status)) {
      throw messagesClosed();
    }

    const conversation = await this.prisma.sellerConversation.create({
      data: {
        sellerId,
        topic: SellerConversationTopic.GENERAL,
        subject,
        lastMessageAt: new Date(),
        messages: { create: { side: author.side, authorId: author.userId, body } },
      },
      select: { id: true },
    });

    await this.changed(sellerId, conversation.id);
    await this.tellSeller(sellerId, author, body);

    return conversation;
  }

  /** Writes in a conversation. For a person of the seller the conversation has to be of that seller. */
  async send(
    conversationId: string,
    author: Author,
    body: string,
    sellerId?: string,
  ): Promise<SellerMessageView> {
    const conversation = await this.find(conversationId, sellerId);

    if (!portalStatuses.includes(conversation.seller.status)) {
      throw messagesClosed();
    }

    const message = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.sellerMessage.create({
        data: { conversationId, side: author.side, authorId: author.userId, body },
        select: shownMessage,
      });

      await transaction.sellerConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: created.createdAt },
      });

      return created;
    });

    await this.changed(conversation.seller.id, conversationId);
    await this.tellSeller(conversation.seller.id, author, body);

    return message;
  }

  /** The reader opened the conversation: everything the other side wrote in it counts as read. */
  async markRead(
    conversationId: string,
    reader: SellerMessageSide,
    sellerId?: string,
  ): Promise<void> {
    const conversation = await this.find(conversationId, sellerId);
    const { count } = await this.prisma.sellerMessage.updateMany({
      where: { conversationId, side: otherSide(reader), readAt: null },
      data: { readAt: new Date() },
    });

    // The numbers of unread messages change on the other open pages of the reader's side.
    if (count > 0) {
      await this.changed(conversation.seller.id, conversationId);
    }
  }

  /**
   * Puts a decision of the team into the conversation about the registration, as a part of the change
   * that makes it. The first decision opens that conversation. Answers with the id of the conversation:
   * the caller reports the change with `changed` once its own change is saved.
   */
  async postDecision(
    { sellerId, authorId, kind, body }: DecisionMessage,
    database: DatabaseClient,
  ): Promise<string> {
    const now = new Date();
    const topic = SellerConversationTopic.REGISTRATION;
    // Decisions about one seller come one at a time: the change of its status waits for the one before.
    const conversation =
      (await database.sellerConversation.findFirst({ where: { sellerId, topic } })) ??
      (await database.sellerConversation.create({
        data: { sellerId, topic, subject: '', lastMessageAt: now },
      }));

    await database.sellerMessage.create({
      data: { conversationId: conversation.id, side: SellerMessageSide.TEAM, kind, authorId, body },
    });
    await database.sellerConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    return conversation.id;
  }

  /** A text of the team also goes to the seller by email, so the seller learns about it without opening the portal. */
  private async tellSeller(sellerId: string, author: Author, body: string): Promise<void> {
    if (author.side === SellerMessageSide.TEAM) {
      await this.notifier.messageFromTeam(sellerId, body);
    }
  }

  private conversations(
    where: Prisma.SellerConversationWhereInput,
    reader: SellerMessageSide,
    limit: number,
    cursor?: string,
  ): Promise<ConversationWithRow[]> {
    return this.prisma.sellerConversation.findMany({
      where,
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
      take: limit + 1,
      include: rowInclude(reader),
    });
  }

  /** The conversation with its seller. The same answer for none and for one of another seller. */
  private async find(conversationId: string, sellerId?: string) {
    const conversation = await this.prisma.sellerConversation.findFirst({
      where: { id: conversationId, sellerId },
      include: { seller: sellerOfConversation },
    });

    if (!conversation) {
      throw conversationNotFound();
    }

    return conversation;
  }
}
