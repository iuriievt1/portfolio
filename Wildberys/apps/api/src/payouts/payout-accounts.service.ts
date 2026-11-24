import { Injectable } from '@nestjs/common';

import { AuditLogService } from '../audit/audit-log.service.js';
import type { DatabaseClient } from '../database/database-client.js';
import { PrismaService } from '../database/prisma.service.js';
import { LiveEvents } from '../live-events/live-events.js';
import type { SellerPayoutAccount } from '../generated/prisma/client.js';
import { PayoutAccountStatus, PayoutMethod } from '../generated/prisma/enums.js';
import type { PayoutAccount } from './payout-account.dto.js';
import { bankAccountRequired, payoutMethodNotBank, payoutMethodRequired } from './payout-errors.js';
import { PayoutProvider, type BankAccountDetails } from './payout-provider.js';

const countryLength = 2;
const shownCharacters = 4;

function toPayoutAccount(account: SellerPayoutAccount): PayoutAccount {
  const { bankAccountHolder, bankAccountCountry, bankAccountLast4, bankAccountCurrency } = account;

  return {
    method: account.method,
    status: account.status,
    // The database keeps the four together: all of them or none.
    bankAccount:
      bankAccountHolder !== null &&
      bankAccountCountry !== null &&
      bankAccountLast4 !== null &&
      bankAccountCurrency !== null
        ? {
            holderName: bankAccountHolder,
            country: bankAccountCountry,
            last4: bankAccountLast4,
            currency: bankAccountCurrency,
          }
        : null,
  };
}

/** How each seller gets paid: the account at the payment provider and what Bluberi knows about it. */
@Injectable()
export class PayoutAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: PayoutProvider,
    private readonly audit: AuditLogService,
    private readonly live: LiveEvents,
  ) {}

  /** The payout account of a seller. While the provider checks it, the provider is asked again. */
  async find(sellerId: string): Promise<PayoutAccount | null> {
    const account = await this.prisma.sellerPayoutAccount.findUnique({ where: { sellerId } });

    if (!account) {
      return null;
    }

    if (account.status !== PayoutAccountStatus.PENDING || !account.submittedAt) {
      return toPayoutAccount(account);
    }

    const status = await this.provider.checkAccount({
      id: account.providerAccountId,
      submittedAt: account.submittedAt,
    });

    if (status === account.status) {
      return toPayoutAccount(account);
    }

    const checked = await this.prisma.sellerPayoutAccount.update({
      where: { sellerId },
      data: { status },
    });

    // The provider decided: the open pages of the seller and of the team show it at once.
    await this.live.report({ kind: 'seller-changed', sellerId });

    return toPayoutAccount(checked);
  }

  /**
   * Opens an account at the provider for the way the seller wants to be paid.
   * The way cannot be changed on an account, so another choice opens a new account and closes the old one.
   */
  async chooseMethod(actorId: string, sellerId: string, method: PayoutMethod): Promise<void> {
    const existing = await this.prisma.sellerPayoutAccount.findUnique({ where: { sellerId } });

    if (existing?.method === method) {
      return;
    }

    const providerAccountId = await this.provider.openAccount(method, sellerId);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.sellerPayoutAccount.upsert({
        where: { sellerId },
        create: { sellerId, method, providerAccountId },
        update: {
          method,
          providerAccountId,
          status: PayoutAccountStatus.INCOMPLETE,
          submittedAt: null,
          bankAccountHolder: null,
          bankAccountCountry: null,
          bankAccountLast4: null,
          bankAccountCurrency: null,
        },
      });
      await this.audit.record(
        {
          action: 'seller.payout_method_chosen',
          actorId,
          target: { type: 'seller', id: sellerId },
          details: { method },
        },
        transaction,
      );
    });

    if (existing) {
      await this.provider.closeAccount(existing.providerAccountId);
    }
  }

  /** Gives the bank account to the provider and keeps only what tells it from another account. */
  async saveBankAccount(
    actorId: string,
    sellerId: string,
    bankAccount: BankAccountDetails,
  ): Promise<void> {
    const account = await this.prisma.sellerPayoutAccount.findUnique({ where: { sellerId } });

    if (!account) {
      throw payoutMethodRequired();
    }

    if (account.method !== PayoutMethod.BANK) {
      throw payoutMethodNotBank();
    }

    await this.provider.saveBankAccount(account.providerAccountId, bankAccount);

    const country = bankAccount.iban.slice(0, countryLength);
    const last4 = bankAccount.iban.slice(-shownCharacters);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.sellerPayoutAccount.update({
        where: { sellerId },
        data: {
          bankAccountHolder: bankAccount.holderName,
          bankAccountCountry: country,
          bankAccountLast4: last4,
          bankAccountCurrency: bankAccount.currency,
        },
      });
      await this.audit.record(
        {
          action: 'seller.bank_account_saved',
          actorId,
          target: { type: 'seller', id: sellerId },
          details: { country, last4, currency: bankAccount.currency },
        },
        transaction,
      );
    });
  }

  /** The seller finished the form of the provider: its check starts, and the provider says where it stands. */
  async finishForm(sellerId: string): Promise<void> {
    const account = await this.prisma.sellerPayoutAccount.findUnique({ where: { sellerId } });

    if (!account) {
      throw payoutMethodRequired();
    }

    if (account.method === PayoutMethod.BANK && account.bankAccountHolder === null) {
      throw bankAccountRequired();
    }

    const submittedAt = account.submittedAt ?? new Date();
    const status = await this.provider.checkAccount({ id: account.providerAccountId, submittedAt });

    await this.prisma.sellerPayoutAccount.update({
      where: { sellerId },
      data: { submittedAt, status },
    });
  }

  /** Forgets the account of a seller who registers another company: it was opened for the first one. */
  async remove(sellerId: string): Promise<void> {
    const close = await this.removeWithin(sellerId, this.prisma);

    await close();
  }

  /**
   * Deletes the payout account of a seller as a part of a larger change. The returned function closes
   * the account at the provider: call it once the change is saved, so nothing is closed for a change that failed.
   */
  async removeWithin(sellerId: string, database: DatabaseClient): Promise<() => Promise<void>> {
    const account = await database.sellerPayoutAccount.findUnique({ where: { sellerId } });

    if (!account) {
      return () => Promise.resolve();
    }

    await database.sellerPayoutAccount.delete({ where: { sellerId } });

    return () => this.provider.closeAccount(account.providerAccountId);
  }
}
