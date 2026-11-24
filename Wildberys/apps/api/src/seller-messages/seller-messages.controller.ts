import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePlatformAccess, RequireSellerRole } from '../access/access.decorators.js';
import type { AuthContext } from '../auth/auth-context.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SellerMemberRole, SellerMessageSide } from '../generated/prisma/enums.js';
import { PageQuery } from '../pagination/page-query.js';
import {
  ConversationParams,
  ConversationsPage,
  ConversationThread,
  OpenConversationBody,
  OpenedConversation,
  SellerConversationParams,
  SellerInboxParams,
  SellerMessageView,
  SendMessageBody,
  TeamConversationsPage,
  TeamConversationThread,
  TeamInboxQuery,
  UnreadMessages,
} from './seller-messages.dto.js';
import { SellerMessagesService } from './seller-messages.service.js';

const { SELLER, TEAM } = SellerMessageSide;

/** The inbox of one seller, for its owner and its staff. */
@ApiTags('Seller: messages')
@Controller('sellers/:sellerId/conversations')
@RequireSellerRole([SellerMemberRole.OWNER, SellerMemberRole.STAFF])
export class SellerInboxController {
  constructor(private readonly messages: SellerMessagesService) {}

  @Get()
  @ApiOperation({
    summary: 'The inbox of the seller',
    description:
      'Conversations with the Bluberi team. The one written in last comes first, with its last message and how many messages are unread.',
  })
  @ApiOkResponse({ type: ConversationsPage })
  inbox(
    @Param() { sellerId }: SellerInboxParams,
    @Query() query: PageQuery,
  ): Promise<ConversationsPage> {
    return this.messages.inboxOfSeller(sellerId, query);
  }

  @Get('unread')
  @ApiOperation({ summary: 'How many messages of Bluberi the seller has not opened yet' })
  @ApiOkResponse({ type: UnreadMessages })
  async unread(@Param() { sellerId }: SellerInboxParams): Promise<UnreadMessages> {
    return { count: await this.messages.unreadCount(SELLER, sellerId) };
  }

  @Post()
  @ApiOperation({
    summary: 'Write to Bluberi about something new',
    description: 'Opens a conversation under a subject. While the portal is open to the seller.',
  })
  @ApiCreatedResponse({ type: OpenedConversation })
  open(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerInboxParams,
    @Body() { subject, body }: OpenConversationBody,
  ): Promise<OpenedConversation> {
    return this.messages.open(sellerId, { side: SELLER, userId: auth.userId }, subject, body);
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'One conversation with its messages, newest first' })
  @ApiOkResponse({ type: ConversationThread })
  thread(
    @Param() { sellerId, conversationId }: SellerConversationParams,
    @Query() query: PageQuery,
  ): Promise<ConversationThread> {
    return this.messages.threadOfSeller(sellerId, conversationId, query);
  }

  @Post(':conversationId/messages')
  @ApiOperation({ summary: 'Answer in a conversation' })
  @ApiCreatedResponse({ type: SellerMessageView })
  send(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId, conversationId }: SellerConversationParams,
    @Body() { body }: SendMessageBody,
  ): Promise<SellerMessageView> {
    return this.messages.send(
      conversationId,
      { side: SELLER, userId: auth.userId },
      body,
      sellerId,
    );
  }

  @Post(':conversationId/reading')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'The seller opened the conversation: the messages of Bluberi in it count as read',
  })
  @ApiNoContentResponse({ description: 'Nothing of Bluberi is unread in the conversation' })
  markRead(@Param() { sellerId, conversationId }: SellerConversationParams): Promise<void> {
    return this.messages.markRead(conversationId, SELLER, sellerId);
  }
}

/** Who of the team reads the conversations with sellers: the support, and those who check sellers. */
const readers = [
  { area: 'supportTickets', level: 'view' },
  { area: 'sellers', level: 'view' },
] as const;
/** Who of the team writes to sellers. What they open counts as read. */
const writers = [
  { area: 'supportTickets', level: 'full' },
  { area: 'sellers', level: 'full' },
] as const;

/** The inbox of the Bluberi team: the conversations with every seller. */
@ApiTags('Admin: messages')
@Controller('admin/conversations')
@RequirePlatformAccess(readers)
export class TeamInboxController {
  constructor(private readonly messages: SellerMessagesService) {}

  @Get()
  @ApiOperation({
    summary: 'The inbox of the team',
    description:
      'Conversations with sellers. The one written in last comes first, with its last message and how many messages of the seller are unread.',
  })
  @ApiOkResponse({ type: TeamConversationsPage })
  inbox(@Query() { sellerId, ...page }: TeamInboxQuery): Promise<TeamConversationsPage> {
    return this.messages.inboxOfTeam(page, sellerId);
  }

  @Get('unread')
  @ApiOperation({ summary: 'How many messages of sellers nobody of the team has opened yet' })
  @ApiOkResponse({ type: UnreadMessages })
  async unread(): Promise<UnreadMessages> {
    return { count: await this.messages.unreadCount(TEAM) };
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'One conversation with its seller and its messages, newest first' })
  @ApiOkResponse({ type: TeamConversationThread })
  thread(
    @Param() { conversationId }: ConversationParams,
    @Query() query: PageQuery,
  ): Promise<TeamConversationThread> {
    return this.messages.threadOfTeam(conversationId, query);
  }

  @Post(':conversationId/messages')
  @RequirePlatformAccess(writers)
  @ApiOperation({
    summary: 'Answer a seller',
    description: 'The seller reads it in the portal and gets it by email.',
  })
  @ApiCreatedResponse({ type: SellerMessageView })
  send(
    @CurrentAuth() auth: AuthContext,
    @Param() { conversationId }: ConversationParams,
    @Body() { body }: SendMessageBody,
  ): Promise<SellerMessageView> {
    return this.messages.send(conversationId, { side: TEAM, userId: auth.userId }, body);
  }

  @Post(':conversationId/reading')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePlatformAccess(writers)
  @ApiOperation({
    summary: 'The team opened the conversation: the messages of the seller in it count as read',
  })
  @ApiNoContentResponse({ description: 'Nothing of the seller is unread in the conversation' })
  markRead(@Param() { conversationId }: ConversationParams): Promise<void> {
    return this.messages.markRead(conversationId, TEAM);
  }
}

/** Writing to one seller about something new, from the admin. */
@ApiTags('Admin: messages')
@Controller('admin/sellers/:sellerId/conversations')
@RequirePlatformAccess(writers)
export class TeamNewConversationController {
  constructor(private readonly messages: SellerMessagesService) {}

  @Post()
  @ApiOperation({
    summary: 'Write to a seller about something new',
    description:
      'Opens a conversation under a subject. The seller reads it in the portal and gets it by email.',
  })
  @ApiCreatedResponse({ type: OpenedConversation })
  open(
    @CurrentAuth() auth: AuthContext,
    @Param() { sellerId }: SellerInboxParams,
    @Body() { subject, body }: OpenConversationBody,
  ): Promise<OpenedConversation> {
    return this.messages.open(sellerId, { side: TEAM, userId: auth.userId }, subject, body);
  }
}
