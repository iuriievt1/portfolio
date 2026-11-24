import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { CompanyAddress } from '../company-registry/company-registry.dto.js';
import {
  CompanyCheck,
  Currency,
  PayoutMethod,
  SellerDocumentKind,
  SellerLegalForm,
  SellerStatus,
} from '../generated/prisma/enums.js';
import { PayoutAccount } from '../payouts/payout-account.dto.js';
import { SellerDocumentInfo } from '../seller-documents/seller-documents.dto.js';
import { IsCompanyId } from '../validation/company-id.js';
import { IsIban } from '../validation/iban.js';
import { postalCodePattern } from '../validation/postal-code.js';
import { tidyCode } from '../validation/tidy-code.js';
import { trimText } from '../validation/trim-text.js';
import { vatNumberPattern } from '../validation/vat-number.js';
import type { EuCountry } from '../vat-registry/eu-countries.js';
import { countriesCheckedByVatNumber } from './seller-countries.js';

const storeNameMinLength = 2;
const storeNameMaxLength = 120;
const holderNameMinLength = 2;
const holderNameMaxLength = 140;
const addressLineMinLength = 2;
const addressLineMaxLength = 120;
const legalNameMinLength = 2;
const legalNameMaxLength = 200;
/** More than any catalog tree has. It only keeps a request small. */
const categoriesMaxCount = 200;
/**
 * A number in the business register of a country: capital letters and digits,
 * with the spaces, dots, slashes and dashes some registers write, like "HRB 86891" and "FN 180219d".
 */
const registrationNumberPattern = /^[0-9A-Z][0-9A-Z ./-]{0,38}[0-9A-Z]$/;

function isNotNull(_body: object, value: unknown): boolean {
  return value !== null;
}

export class RegisterCompanyBody {
  @ApiProperty({
    example: '27082440',
    description:
      'The company number (IČO). The name, the legal form, the tax number and the address are read from the register.',
  })
  @IsCompanyId()
  readonly ico!: string;

  @ApiProperty({ description: 'The seller is a payer of VAT. Needs a tax number in the register.' })
  @IsBoolean()
  readonly isVatPayer!: boolean;

  @ApiProperty({
    enum: [true],
    description: 'The person agreed to the terms for sellers. Only true is accepted.',
  })
  @Equals(true)
  readonly termsAccepted!: boolean;
}

/** An address without its country: the country is the one of the seller. */
export class PostalAddressBody {
  @ApiProperty({ example: 'Korunní 2569/108' })
  @Transform(trimText)
  @IsString()
  @MinLength(addressLineMinLength)
  @MaxLength(addressLineMaxLength)
  readonly street!: string;

  @ApiProperty({ example: 'Praha 10' })
  @Transform(trimText)
  @IsString()
  @MinLength(addressLineMinLength)
  @MaxLength(addressLineMaxLength)
  readonly city!: string;

  @ApiProperty({
    example: '10100',
    description:
      'Capital letters, digits, spaces and dashes. A Czech code is five digits without a space.',
  })
  @Transform(tidyCode)
  @Matches(postalCodePattern)
  readonly postalCode!: string;
}

export class RegisterEuCompanyBody {
  @ApiProperty({
    example: 'PL',
    description:
      'The EU country the company is registered in, ISO 3166-1 alpha-2: one of the countries of the registration. ' +
      'A Czech company is registered by its company number instead.',
  })
  @IsIn(countriesCheckedByVatNumber)
  readonly countryCode!: EuCountry;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '5252674798',
    description:
      'The VAT number without the letters of the country, checked in the register of VAT numbers of the EU. ' +
      'Null for a trader who has none: the team then checks the documents of the seller.',
  })
  @ValidateIf(isNotNull)
  @Matches(vatNumberPattern)
  readonly vatNumber!: string | null;

  @ApiProperty({
    example: '0000635012',
    description: 'The number of the company in the business register of its country.',
  })
  @Transform(tidyCode)
  @Matches(registrationNumberPattern)
  readonly registrationNumber!: string;

  @ApiProperty({
    example: 'Allegro sp. z o.o.',
    description:
      'Saved when the register does not share the name of the company. Otherwise the name of the register is saved.',
  })
  @Transform(trimText)
  @IsString()
  @MinLength(legalNameMinLength)
  @MaxLength(legalNameMaxLength)
  readonly legalName!: string;

  @ApiProperty({ enum: SellerLegalForm, enumName: 'SellerLegalForm' })
  @IsEnum(SellerLegalForm)
  readonly legalForm!: SellerLegalForm;

  @ApiProperty({
    type: PostalAddressBody,
    description: 'The registered address of the company, in the country of the company.',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => PostalAddressBody)
  readonly address!: PostalAddressBody;

  @ApiProperty({
    enum: [true],
    description: 'The person agreed to the terms for sellers. Only true is accepted.',
  })
  @Equals(true)
  readonly termsAccepted!: boolean;
}

export class SubmitBody {
  @ApiProperty({
    enum: [true],
    description:
      'The owner promises to offer only goods that comply with the law of the EU. Only true is accepted.',
  })
  @Equals(true)
  readonly selfCertified!: boolean;
}

export class DocumentParams {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly documentId!: string;
}

export class ChoosePayoutMethodBody {
  @ApiProperty({ enum: PayoutMethod, enumName: 'PayoutMethod' })
  @IsEnum(PayoutMethod)
  readonly method!: PayoutMethod;
}

export class SaveBankAccountBody {
  @ApiProperty({
    example: 'CZ6508000000192000145399',
    description: 'Capital letters and digits without spaces, with right check digits.',
  })
  @IsIban()
  readonly iban!: string;

  @ApiProperty({
    example: 'Studio Lila s.r.o.',
    description: 'The name the account is held under.',
  })
  @Transform(trimText)
  @IsString()
  @MinLength(holderNameMinLength)
  @MaxLength(holderNameMaxLength)
  readonly holderName!: string;

  @ApiProperty({
    enum: Currency,
    enumName: 'Currency',
    description: 'The currency the account is held in. An account abroad is usually held in euros.',
  })
  @IsEnum(Currency)
  readonly currency!: Currency;
}

export class SaveStoreBody {
  @ApiProperty({
    example: 'Studio Lila',
    minLength: storeNameMinLength,
    description: 'The address of the store is made from it, so two stores cannot share a name.',
  })
  @Transform(trimText)
  @IsString()
  @MinLength(storeNameMinLength)
  @MaxLength(storeNameMaxLength)
  readonly name!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'A photo this person uploaded. Null for a store without a logo.',
  })
  @ValidateIf(isNotNull)
  @IsUUID()
  readonly logoImageId!: string | null;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    description:
      'What the store sells: ids of sections or of subcategories. A section stands for all of its subcategories.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(categoriesMaxCount)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  readonly categoryIds!: string[];

  @ApiProperty({
    type: PostalAddressBody,
    nullable: true,
    description:
      'Where buyers send goods back, in the country of the seller. Null when it is the registered address of the company.',
  })
  @ValidateIf(isNotNull)
  @IsObject()
  @ValidateNested()
  @Type(() => PostalAddressBody)
  readonly returnAddress!: PostalAddressBody | null;
}

export class RegistrationAccount {
  @ApiProperty()
  readonly email!: string;

  @ApiProperty({ type: String, nullable: true })
  readonly phone!: string | null;

  @ApiProperty()
  readonly phoneVerified!: boolean;

  @ApiProperty()
  readonly hasPassword!: boolean;
}

export class RegistrationCompany {
  @ApiProperty({
    example: 'CZ',
    description: 'The country the company is registered in, ISO 3166-1 alpha-2.',
  })
  readonly countryCode!: string;

  @ApiProperty({
    example: '27082440',
    description:
      'The number of the company in the business register of its country. In Czechia it is the IČO.',
  })
  readonly registrationNumber!: string;

  @ApiProperty({ example: 'Studio Lila s.r.o.' })
  readonly legalName!: string;

  @ApiProperty({ enum: SellerLegalForm, enumName: 'SellerLegalForm' })
  readonly legalForm!: SellerLegalForm;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The VAT number with the letters of its country. In Czechia it is the DIČ.',
  })
  readonly vatNumber!: string | null;

  @ApiProperty()
  readonly isVatPayer!: boolean;

  @ApiProperty({ type: CompanyAddress, description: 'The registered address.' })
  readonly address!: CompanyAddress;

  @ApiProperty({
    enum: CompanyCheck,
    enumName: 'CompanyCheck',
    description:
      'COMPANY_REGISTER: read from the company register of its country. VAT_REGISTER: its VAT number is valid ' +
      'in the register of the EU. DOCUMENTS: no register confirmed it, the team checks its documents.',
  })
  readonly check!: CompanyCheck;
}

export class RegistrationStoreLogo {
  @ApiProperty({ format: 'uuid' })
  readonly imageId!: string;

  @ApiProperty({ description: 'The address of the smallest stored copy of the photo.' })
  readonly url!: string;
}

export class RegistrationReturnAddress {
  @ApiProperty()
  readonly street!: string;

  @ApiProperty()
  readonly city!: string;

  @ApiProperty()
  readonly postalCode!: string;
}

export class RegistrationStore {
  @ApiProperty({ example: 'Studio Lila' })
  readonly name!: string;

  @ApiProperty({
    example: 'studio-lila',
    description: 'The address of the store, made from its name.',
  })
  readonly slug!: string;

  @ApiProperty({ type: RegistrationStoreLogo, nullable: true })
  readonly logo!: RegistrationStoreLogo | null;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description:
      'What the store sells, written the short way: a section in place of all of its subcategories.',
  })
  readonly categoryIds!: string[];

  @ApiProperty({
    type: RegistrationReturnAddress,
    nullable: true,
    description: 'Null when goods come back to the registered address of the company.',
  })
  readonly returnAddress!: RegistrationReturnAddress | null;
}

export class RegistrationSeller {
  @ApiProperty({ format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    enum: SellerStatus,
    enumName: 'SellerStatus',
    description:
      'DRAFT until the registration is sent, PENDING_REVIEW while Bluberi checks it, ' +
      'DOCUMENTS_REQUESTED while Bluberi waits for documents, then APPROVED or REJECTED.',
  })
  readonly status!: SellerStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'What the team wrote with its last decision: which documents to send, or why the seller was refused.',
  })
  readonly reviewMessage!: string | null;

  @ApiProperty({ type: RegistrationCompany })
  readonly company!: RegistrationCompany;

  @ApiProperty({
    type: PayoutAccount,
    nullable: true,
    description: 'Null until the seller chooses how to be paid.',
  })
  readonly payoutAccount!: PayoutAccount | null;

  @ApiProperty({
    type: RegistrationStore,
    nullable: true,
    description: 'Null until the store is set up.',
  })
  readonly store!: RegistrationStore | null;

  @ApiProperty({
    type: [SellerDocumentInfo],
    description: 'The documents the seller gave, oldest first.',
  })
  readonly documents!: SellerDocumentInfo[];

  @ApiProperty({
    enum: SellerDocumentKind,
    enumName: 'SellerDocumentKind',
    isArray: true,
    description:
      'The kinds of documents the registration is sent with. A document of each kind has to be there.',
  })
  readonly requiredDocuments!: SellerDocumentKind[];
}

/** Where the registration of the signed-in person as a seller stands. Every step answers with it. */
export class SellerRegistration {
  @ApiProperty({ type: RegistrationAccount })
  readonly account!: RegistrationAccount;

  @ApiProperty({
    type: RegistrationSeller,
    nullable: true,
    description: 'The seller this person owns. Null until the company is registered.',
  })
  readonly seller!: RegistrationSeller | null;

  @ApiProperty({
    description:
      'The person works for a seller that is being checked or was approved, so the seller portal is open to them.',
  })
  readonly portalOpen!: boolean;

  @ApiProperty({
    type: [String],
    example: ['CZ', 'PL', 'SK'],
    description:
      'The countries a company of a seller can be registered in, ISO 3166-1 alpha-2. ' +
      'A Czech company is registered by its company number, a company of another country by its VAT number.',
  })
  readonly countries!: readonly string[];
}
