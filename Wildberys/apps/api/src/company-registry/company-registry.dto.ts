import { ApiProperty } from '@nestjs/swagger';

import { SellerLegalForm } from '../generated/prisma/enums.js';
import { IsCompanyId } from '../validation/company-id.js';

export class CompanyParams {
  @ApiProperty({
    example: '27082440',
    description: 'The company number (IČO): eight digits with a right check digit.',
  })
  @IsCompanyId()
  readonly ico!: string;
}

export class CompanyAddress {
  @ApiProperty({ example: 'Korunní 2569/108' })
  readonly street!: string;

  @ApiProperty({ example: 'Praha 10' })
  readonly city!: string;

  @ApiProperty({ example: '10100' })
  readonly postalCode!: string;

  @ApiProperty({ example: 'CZ', description: 'ISO 3166-1 alpha-2.' })
  readonly countryCode!: string;
}

/** What the public register says about a company. */
export class Company {
  @ApiProperty({ example: '27082440', description: 'The company number (IČO).' })
  readonly ico!: string;

  @ApiProperty({ example: 'Studio Lila s.r.o.' })
  readonly legalName!: string;

  @ApiProperty({ enum: SellerLegalForm, enumName: 'SellerLegalForm' })
  readonly legalForm!: SellerLegalForm;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'CZ27082440',
    description: 'The tax number (DIČ). Null when the register has none.',
  })
  readonly vatNumber!: string | null;

  @ApiProperty({ description: 'The register lists the company as a payer of VAT.' })
  readonly isVatPayer!: boolean;

  @ApiProperty({ type: CompanyAddress, description: 'The registered address.' })
  readonly address!: CompanyAddress;
}
