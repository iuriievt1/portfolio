import { ApiProperty } from '@nestjs/swagger';
import { IsIn, Matches } from 'class-validator';

import { vatNumberPattern } from '../validation/vat-number.js';
import { euCountries, type EuCountry } from './eu-countries.js';

export class VatNumberParams {
  @ApiProperty({
    example: 'PL',
    description: 'The EU country of the number, ISO 3166-1 alpha-2. Greece is GR.',
  })
  @IsIn(euCountries)
  readonly countryCode!: EuCountry;

  @ApiProperty({
    example: '5252674798',
    description: 'The VAT number without the letters of the country: capital letters and digits.',
  })
  @Matches(vatNumberPattern)
  readonly number!: string;
}

/** What the register of VAT numbers says about a number that is valid. */
export class CheckedVatNumber {
  @ApiProperty({
    example: 'PL5252674798',
    description:
      'The number with the letters of its country in front. A Greek number starts with EL.',
  })
  readonly vatNumber!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'ALLEGRO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    description:
      'The name the number is registered under. Null when its country does not share names.',
  })
  readonly name!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'WIERZBIĘCICE 1B, 61-569 POZNAŃ',
    description: 'The address in one line. Null when its country does not share addresses.',
  })
  readonly address!: string | null;
}
