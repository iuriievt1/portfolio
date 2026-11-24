import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

import { auditActions, type AuditAction } from '../audit/audit-events.js';
import { CompanyAddress } from '../company-registry/company-registry.dto.js';
import { tradeKinds, type TradeKind } from '../company-registry/company-registry.js';
import {
  CompanyCheck,
  PayoutAccountStatus,
  SellerDocumentKind,
  SellerLegalForm,
  SellerStatus,
} from '../generated/prisma/enums.js';
import { PageQuery } from '../pagination/page-query.js';
import { PayoutAccount } from '../payouts/payout-account.dto.js';
import { SellerDocumentInfo } from '../seller-documents/seller-documents.dto.js';
import { trimText } from '../validation/trim-text.js';

const messageMinLength = 5;
const messageMaxLength = 2000;

export class SellersQuery extends PageQuery {
  @ApiProperty({ enum: SellerStatus, enumName: 'SellerStatus' })
  @IsEnum(SellerStatus)
  readonly status!: SellerStatus;
}

export class SellerParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly sellerId!: string;
}

export class SellerDocumentParams extends SellerParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly documentId!: string;
}

export class DecisionBody {
  @ApiProperty({
    minLength: messageMinLength,
    maxLength: messageMaxLength,
    example: 'Pošlete prosím výpis z obchodního rejstříku, ne starší než tři měsíce.',
    description: 'What the seller is told: which documents to send, or why the seller is refused.',
  })
  @Transform(trimText)
  @IsString()
  @MinLength(messageMinLength)
  @MaxLength(messageMaxLength)
  readonly message!: string;
}

/** A section of the catalog a store sells in, with the names in Czech. */
export class SoldSection {
  @ApiProperty({ example: 'Kosmetika' })
  readonly section!: string;

  @ApiProperty({
    type: [String],
    example: ['Péče o pleť', 'Vlasy'],
    description: 'The subcategories the store chose. Empty when it sells the whole section.',
  })
  readonly subcategories!: string[];
}

/** One seller in a list of the moderation. */
export class ModeratedSellerRow {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ example: 'Studio Lila s.r.o.' })
  readonly legalName!: string;

  @ApiProperty({ example: 'CZ', description: 'ISO 3166-1 alpha-2.' })
  readonly countryCode!: string;

  @ApiProperty({ example: '27082440' })
  readonly registrationNumber!: string;

  @ApiProperty({ enum: SellerStatus, enumName: 'SellerStatus' })
  readonly status!: SellerStatus;

  @ApiProperty({ enum: CompanyCheck, enumName: 'CompanyCheck' })
  readonly companyCheck!: CompanyCheck;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the registration was last sent for a check. Null for a draft.',
  })
  readonly submittedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, example: 'Studio Lila' })
  readonly storeName!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'The smallest copy of the logo.' })
  readonly logoUrl!: string | null;

  @ApiProperty({ type: [SoldSection], description: 'What the store sells, section by section.' })
  readonly categories!: SoldSection[];

  @ApiProperty({ type: 'integer' })
  readonly documentsCount!: number;

  @ApiProperty({
    type: 'integer',
    description:
      'In how many conversations the seller wrote something nobody of the team has opened yet.',
  })
  readonly unreadConversations!: number;

  @ApiProperty({
    enum: PayoutAccountStatus,
    enumName: 'PayoutAccountStatus',
    nullable: true,
    description: 'Null until the seller chooses how to be paid.',
  })
  readonly payoutStatus!: PayoutAccountStatus | null;
}

export class ModeratedSellersPage {
  @ApiProperty({ type: [ModeratedSellerRow] })
  readonly items!: ModeratedSellerRow[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  readonly nextCursor!: string | null;
}

/** How many sellers are in each status. */
export class SellerCounts implements Record<SellerStatus, number> {
  @ApiProperty({ type: 'integer' })
  readonly DRAFT!: number;

  @ApiProperty({ type: 'integer' })
  readonly PENDING_REVIEW!: number;

  @ApiProperty({ type: 'integer' })
  readonly DOCUMENTS_REQUESTED!: number;

  @ApiProperty({ type: 'integer' })
  readonly APPROVED!: number;

  @ApiProperty({ type: 'integer' })
  readonly REJECTED!: number;

  @ApiProperty({ type: 'integer' })
  readonly SUSPENDED!: number;
}

export class ModeratedCompany {
  @ApiProperty({ example: 'CZ', description: 'The country of registration, ISO 3166-1 alpha-2.' })
  readonly countryCode!: string;

  @ApiProperty({ example: '27082440' })
  readonly registrationNumber!: string;

  @ApiProperty({ example: 'Studio Lila s.r.o.' })
  readonly legalName!: string;

  @ApiProperty({ enum: SellerLegalForm, enumName: 'SellerLegalForm' })
  readonly legalForm!: SellerLegalForm;

  @ApiProperty({ type: String, nullable: true })
  readonly vatNumber!: string | null;

  @ApiProperty()
  readonly isVatPayer!: boolean;

  @ApiProperty({ enum: CompanyCheck, enumName: 'CompanyCheck' })
  readonly check!: CompanyCheck;

  @ApiProperty({ type: CompanyAddress, description: 'The registered address.' })
  readonly address!: CompanyAddress;
}

export class ModeratedStore {
  @ApiProperty({ example: 'Studio Lila' })
  readonly name!: string;

  @ApiProperty({ example: 'studio-lila' })
  readonly slug!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly logoUrl!: string | null;

  @ApiProperty({ type: [SoldSection], description: 'What the store sells, section by section.' })
  readonly categories!: SoldSection[];

  @ApiProperty({ type: CompanyAddress, description: 'Where buyers send goods back.' })
  readonly returnAddress!: CompanyAddress;
}

/**
 * What the Digital Services Act (Article 30) asks a marketplace to have about a trader
 * before the trader sells. True for what Bluberi has.
 */
export class SellerTraceability {
  @ApiProperty({ description: 'The name, the phone and the email of the trader.' })
  readonly contacts!: boolean;

  @ApiProperty()
  readonly address!: boolean;

  @ApiProperty({ description: 'A copy of an identity document.' })
  readonly identityDocument!: boolean;

  @ApiProperty({ description: 'The payment account, which the payment provider keeps.' })
  readonly paymentAccount!: boolean;

  @ApiProperty({ description: 'The number in a business register.' })
  readonly registrationNumber!: boolean;

  @ApiProperty({
    description: 'The promise to offer only goods that comply with the law of the EU.',
  })
  readonly selfCertification!: boolean;
}

export class SellerHistoryEntry {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: auditActions, enumName: 'AuditAction' })
  readonly action!: AuditAction;

  @ApiProperty({ type: String, nullable: true, description: 'Who did it.' })
  readonly actorEmail!: string | null;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'What the seller was told, for a decision.',
  })
  readonly message!: string | null;
}

/** Everything the team looks at to decide about a seller. */
export class ModeratedSeller {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ enum: SellerStatus, enumName: 'SellerStatus' })
  readonly status!: SellerStatus;

  @ApiProperty({ type: String, nullable: true, description: 'What the team told the seller last.' })
  readonly reviewMessage!: string | null;

  @ApiProperty({ format: 'date-time' })
  readonly createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly submittedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly reviewedAt!: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Who made the last decision.' })
  readonly reviewedByEmail!: string | null;

  @ApiProperty({ type: ModeratedCompany })
  readonly company!: ModeratedCompany;

  @ApiProperty()
  readonly contactEmail!: string;

  @ApiProperty()
  readonly contactPhone!: string;

  @ApiProperty({ format: 'date-time' })
  readonly termsAcceptedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readonly selfCertifiedAt!: Date | null;

  @ApiProperty({ type: PayoutAccount, nullable: true })
  readonly payoutAccount!: PayoutAccount | null;

  @ApiProperty({ type: ModeratedStore, nullable: true })
  readonly store!: ModeratedStore | null;

  @ApiProperty({ type: [SellerDocumentInfo] })
  readonly documents!: SellerDocumentInfo[];

  @ApiProperty({ enum: SellerDocumentKind, enumName: 'SellerDocumentKind', isArray: true })
  readonly requiredDocuments!: SellerDocumentKind[];

  @ApiProperty({ type: SellerTraceability })
  readonly traceability!: SellerTraceability;

  @ApiProperty({
    type: [SellerHistoryEntry],
    description: 'What happened to the seller, newest first.',
  })
  readonly history!: SellerHistoryEntry[];
}

export const registerCheckResults = [
  'MATCHES',
  'DIFFERS',
  'NOT_FOUND',
  'UNAVAILABLE',
  'NOT_CHECKED',
] as const;

export type RegisterCheckResult = (typeof registerCheckResults)[number];

/** What of a company can differ from its record in a register. */
export const registerDifferences = [
  'legalName',
  'legalForm',
  'vatNumber',
  'address',
  'closed',
] as const;

export type RegisterDifference = (typeof registerDifferences)[number];

export class RegisterTrade {
  @ApiProperty({
    example: 'Výroba, obchod a služby neuvedené v přílohách 1 až 3 živnostenského zákona',
  })
  readonly name!: string;

  @ApiProperty({
    enum: tradeKinds,
    enumName: 'TradeKind',
    description:
      'FREE: anybody can announce it. CRAFT and PROFESSIONAL need a qualification. CONCESSION is granted by the state.',
  })
  readonly kind!: TradeKind;

  @ApiProperty({ format: 'date', example: '2003-08-26' })
  readonly since!: string;

  @ApiProperty({ type: [String], example: ['Velkoobchod a maloobchod'] })
  readonly fields!: readonly string[];
}

/** What the public registers say about the company of a seller right now. */
export class SellerRegisterCheck {
  @ApiProperty({
    enum: registerCheckResults,
    enumName: 'RegisterCheckResult',
    description:
      'MATCHES: the register says what the seller has. DIFFERS: something changed since the registration. ' +
      'NOT_FOUND: the register has no such company or number now. UNAVAILABLE: the register does not answer. ' +
      'NOT_CHECKED: no register can be asked about this seller.',
  })
  readonly result!: RegisterCheckResult;

  @ApiProperty({ enum: registerDifferences, enumName: 'RegisterDifference', isArray: true })
  readonly differences!: RegisterDifference[];

  @ApiProperty({ type: String, nullable: true, description: 'The name the register has now.' })
  readonly registerName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The address the register has now, in one line.',
  })
  readonly registerAddress!: string | null;

  @ApiProperty({
    type: [RegisterTrade],
    nullable: true,
    description:
      'The trade licences a Czech company holds now. Null when the trade register has no record of it, does not answer, or the company is not Czech.',
  })
  readonly trades!: RegisterTrade[] | null;

  @ApiProperty({
    type: Boolean,
    nullable: true,
    description:
      'The trade licences let the company sell goods to buyers. Null when the licences are not known.',
  })
  readonly retailTrade!: boolean | null;
}
