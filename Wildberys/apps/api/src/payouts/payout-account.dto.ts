import { ApiProperty } from '@nestjs/swagger';

import { Currency, PayoutAccountStatus, PayoutMethod } from '../generated/prisma/enums.js';

export class PayoutBankAccount {
  @ApiProperty({
    example: 'Studio Lila s.r.o.',
    description: 'The name the account is held under.',
  })
  readonly holderName!: string;

  @ApiProperty({ example: 'CZ', description: 'The country of the IBAN, ISO 3166-1 alpha-2.' })
  readonly country!: string;

  @ApiProperty({
    example: '5399',
    description: 'The last four characters of the IBAN. The whole number is kept by the provider.',
  })
  readonly last4!: string;

  @ApiProperty({
    enum: Currency,
    enumName: 'Currency',
    description: 'The currency the account is held in.',
  })
  readonly currency!: Currency;
}

/** How a seller gets paid and where the check of the payment provider stands. */
export class PayoutAccount {
  @ApiProperty({
    enum: PayoutMethod,
    enumName: 'PayoutMethod',
    description:
      'STRIPE: the seller has an account at Stripe. BANK: the seller gave a bank account and has no Stripe account.',
  })
  readonly method!: PayoutMethod;

  @ApiProperty({
    enum: PayoutAccountStatus,
    enumName: 'PayoutAccountStatus',
    description:
      'INCOMPLETE until the seller finishes the form of the provider, PENDING while the provider checks, VERIFIED after.',
  })
  readonly status!: PayoutAccountStatus;

  @ApiProperty({
    type: PayoutBankAccount,
    nullable: true,
    description: 'Only with the method BANK, once the seller gave the account.',
  })
  readonly bankAccount!: PayoutBankAccount | null;
}
