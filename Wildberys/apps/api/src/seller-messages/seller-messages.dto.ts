import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import {
  SellerConversationTopic,
  SellerMessageKind,
  SellerMessageSide,
} from '../generated/prisma/enums.js';
import { PageQuery } from '../pagination/page-query.js';
import { trimText } from '../validation/trim-text.js';

export const subjectMaxLength = 120;
export const messageMaxLength = 2000;

export class SellerInboxParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly sellerId!: string;
}

export class SellerConversationParams extends SellerInboxParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly conversationId!: string;
}

export class ConversationParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly conversationId!: string;
}

export class TeamInboxQuery extends PageQuery {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only the conversations with this seller.' })
  @IsOptional()
  @IsUUID()
  readonly sellerId?: string;
}

export class SendMessageBody {
  @ApiProperty({ minLength: 1, maxLength: messageMaxLength, example: 'Dobrý den, výpis posílám.' })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(messageMaxLength)
  readonly body!: string;
}

export class OpenConversationBody extends SendMessageBody {
  @ApiProperty({ minLength: 1, maxLength: subjectMaxLength, example: 'Dotaz ke kategoriím' })
  @Transform(trimText)
  @IsString()
  @MinLength(1)
  @MaxLength(subjectMaxLength)
  readonly subject!: string;
}

/** One message of a conversation. */
export class SellerMessageView {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    enum: SellerMessageSide,
    enumName: 'SellerMessageSide',
    description: 'TEAM: the Bluberi team wrote it. SELLER: a person of the seller did.',
  })
  readonly side!: SellerMessageSide;

  @ApiProperty({
    enum: SellerMessageKind,
    enumName: 'SellerMessageKind',
    description:
      'TEXT: a message one side wrote. The others are decisions of the team about the registration: ' +
      'DOCUMENTS_REQUESTED and REJECTED come with a text, APPROVED with none.',
  })
  readonly kind!: SellerMessageKind;

  @ApiProperty({ description: 'Empty only for an approval.' })
  readonly body!: string;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the other side opened the conversation with this message in it.',
  })
  readonly readAt!: Date | null;
}

/** The same message as the team sees it: with the person who wrote it. */
export class TeamSellerMessageView extends SellerMessageView {
  @ApiProperty({ description: 'The email of the person who wrote the message.' })
  readonly authorEmail!: string;
}

/** The last message of a conversation, as much of it as a line of an inbox shows. */
export class MessagePreview {
  @ApiProperty({ enum: SellerMessageSide, enumName: 'SellerMessageSide' })
  readonly side!: SellerMessageSide;

  @ApiProperty({ enum: SellerMessageKind, enumName: 'SellerMessageKind' })
  readonly kind!: SellerMessageKind;

  @ApiProperty({ description: 'The start of the text.' })
  readonly body!: string;
}

/** One conversation in an inbox. */
export class ConversationRow {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    enum: SellerConversationTopic,
    enumName: 'SellerConversationTopic',
    description:
      'REGISTRATION: the one conversation about the registration, where the decisions of the team go. ' +
      'GENERAL: a conversation one side opened under a subject.',
  })
  readonly topic!: SellerConversationTopic;

  @ApiProperty({ description: 'Empty for the registration: the apps name that conversation.' })
  readonly subject!: string;

  @ApiProperty({ format: 'date-time' })
  readonly lastMessageAt!: Date;

  @ApiProperty({ type: MessagePreview })
  readonly lastMessage!: MessagePreview;

  @ApiProperty({
    type: 'integer',
    description: 'How many messages of the other side the reader has not opened yet.',
  })
  readonly unreadCount!: number;
}

export class ConversationSeller {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Studio Lila s.r.o.' })
  readonly legalName!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Studio Lila' })
  readonly storeName!: string | null;
}

/** One conversation in the inbox of the team: with the seller it is with. */
export class TeamConversationRow extends ConversationRow {
  @ApiProperty({ type: ConversationSeller })
  readonly seller!: ConversationSeller;
}

export class ConversationsPage {
  @ApiProperty({ type: [ConversationRow], description: 'The one written in last comes first.' })
  readonly items!: ConversationRow[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  readonly nextCursor!: string | null;
}

export class TeamConversationsPage {
  @ApiProperty({ type: [TeamConversationRow], description: 'The one written in last comes first.' })
  readonly items!: TeamConversationRow[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  readonly nextCursor!: string | null;
}

/** A conversation with one page of its messages. */
export class ConversationThread {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: SellerConversationTopic, enumName: 'SellerConversationTopic' })
  readonly topic!: SellerConversationTopic;

  @ApiProperty()
  readonly subject!: string;

  @ApiProperty({ description: 'The two sides can write now: the seller has the portal.' })
  readonly open!: boolean;

  @ApiProperty({ type: [SellerMessageView], description: 'Newest first.' })
  readonly messages!: SellerMessageView[];

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Send it as the cursor to read older messages. Null when there are none.',
  })
  readonly nextCursor!: string | null;
}

export class TeamConversationThread {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: SellerConversationTopic, enumName: 'SellerConversationTopic' })
  readonly topic!: SellerConversationTopic;

  @ApiProperty()
  readonly subject!: string;

  @ApiProperty({ description: 'The two sides can write now: the seller has the portal.' })
  readonly open!: boolean;

  @ApiProperty({ type: ConversationSeller })
  readonly seller!: ConversationSeller;

  @ApiProperty({ type: [TeamSellerMessageView], description: 'Newest first.' })
  readonly messages!: TeamSellerMessageView[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  readonly nextCursor!: string | null;
}

/** A conversation that was just opened. */
export class OpenedConversation {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;
}

export class UnreadMessages {
  @ApiProperty({
    type: 'integer',
    description: 'How many messages of the other side nobody has opened yet.',
  })
  readonly count!: number;
}
