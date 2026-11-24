import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { PayoutAccountStatus, type PayoutMethod } from '../generated/prisma/enums.js';
import { PayoutProvider, type AccountCheckResult, type AccountToCheck } from './payout-provider.js';

/** How long the provider "checks" a seller in the simulation. */
export const simulatedCheckMilliseconds = 30_000;

/**
 * Stands in for Stripe until a Stripe account is connected. It opens accounts that exist nowhere,
 * forgets the bank account it is given and passes every seller a short while after the form is finished.
 * No money can be paid through it.
 */
@Injectable()
export class SimulatedPayoutProvider extends PayoutProvider {
  private readonly logger = new Logger('Payouts');

  openAccount(method: PayoutMethod, sellerId: string): Promise<string> {
    const accountId = `acct_simulated_${randomUUID().replaceAll('-', '')}`;

    this.logger.log('Payout account opened in the simulation, no payment provider is connected', {
      accountId,
      method,
      sellerId,
    });

    return Promise.resolve(accountId);
  }

  closeAccount(): Promise<void> {
    return Promise.resolve();
  }

  saveBankAccount(): Promise<void> {
    return Promise.resolve();
  }

  checkAccount({ submittedAt }: AccountToCheck): Promise<AccountCheckResult> {
    const checked = Date.now() - submittedAt.getTime() >= simulatedCheckMilliseconds;

    return Promise.resolve(checked ? PayoutAccountStatus.VERIFIED : PayoutAccountStatus.PENDING);
  }
}
