import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';

import { AppModule } from '../../src/app.module.js';
import { companyRegistryUnavailable } from '../../src/company-registry/company-registry-errors.js';
import {
  CompanyRegistry,
  type RegistryCompany,
  type RegistryTrade,
} from '../../src/company-registry/company-registry.js';
import { configureApp } from '../../src/configure-app.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { PayoutAccountStatus, type PayoutMethod } from '../../src/generated/prisma/enums.js';
import { MailSender, type EmailMessage } from '../../src/mail/mail-sender.js';
import {
  PayoutProvider,
  type AccountCheckResult,
  type BankAccountDetails,
} from '../../src/payouts/payout-provider.js';
import { SmsSender, type SmsMessage } from '../../src/sms/sms-sender.js';
import { vatRegistryUnavailable } from '../../src/vat-registry/vat-registry-errors.js';
import { VatRegistry, type VatRecord } from '../../src/vat-registry/vat-registry.js';

/** Keeps emails in memory, so a test can read the code that was "sent". */
export class RecordingMailSender extends MailSender {
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<void> {
    this.sent.push(message);

    return Promise.resolve();
  }
}

export class RecordingSmsSender extends SmsSender {
  readonly sent: SmsMessage[] = [];

  send(message: SmsMessage): Promise<void> {
    this.sent.push(message);

    return Promise.resolve();
  }
}

/** A register that knows the companies a test puts into it. A test can also switch it off. */
export class FakeCompanyRegistry extends CompanyRegistry {
  readonly companies = new Map<string, RegistryCompany>();
  /** The trade licences by company number. A company that is not here has no record in the trade register. */
  readonly licences = new Map<string, RegistryTrade[]>();
  available = true;

  find(ico: string): Promise<RegistryCompany | null> {
    return this.available
      ? Promise.resolve(this.companies.get(ico) ?? null)
      : Promise.reject(companyRegistryUnavailable());
  }

  trades(ico: string): Promise<RegistryTrade[] | null> {
    return this.available
      ? Promise.resolve(this.licences.get(ico) ?? null)
      : Promise.reject(companyRegistryUnavailable());
  }

  reset(): void {
    this.companies.clear();
    this.licences.clear();
    this.available = true;
  }
}

/** A register of VAT numbers that knows the numbers a test puts into it. A test can also switch it off. */
export class FakeVatRegistry extends VatRegistry {
  /** By the number with the letters of its country, like PL5252674798. */
  readonly records = new Map<string, VatRecord>();
  available = true;

  find(countryCode: string, number: string): Promise<VatRecord | null> {
    return this.available
      ? Promise.resolve(this.records.get(`${countryCode}${number}`) ?? null)
      : Promise.reject(vatRegistryUnavailable());
  }

  reset(): void {
    this.records.clear();
    this.available = true;
  }
}

/** A payment provider that remembers what it was asked and answers what a test tells it to. */
export class FakePayoutProvider extends PayoutProvider {
  readonly opened: { accountId: string; method: PayoutMethod; sellerId: string }[] = [];
  readonly closed: string[] = [];
  readonly bankAccounts: ({ accountId: string } & BankAccountDetails)[] = [];
  /** What the provider says about every account whose form is finished. */
  checkResult: AccountCheckResult = PayoutAccountStatus.PENDING;

  openAccount(method: PayoutMethod, sellerId: string): Promise<string> {
    const accountId = `acct_test_${String(this.opened.length + 1)}`;

    this.opened.push({ accountId, method, sellerId });

    return Promise.resolve(accountId);
  }

  closeAccount(accountId: string): Promise<void> {
    this.closed.push(accountId);

    return Promise.resolve();
  }

  saveBankAccount(accountId: string, bankAccount: BankAccountDetails): Promise<void> {
    this.bankAccounts.push({ accountId, ...bankAccount });

    return Promise.resolve();
  }

  checkAccount(): Promise<AccountCheckResult> {
    return Promise.resolve(this.checkResult);
  }

  reset(): void {
    this.opened.length = 0;
    this.closed.length = 0;
    this.bankAccounts.length = 0;
    this.checkResult = PayoutAccountStatus.PENDING;
  }
}

export interface TestApp {
  readonly app: INestApplication<App>;
  readonly prisma: PrismaService;
  readonly mail: RecordingMailSender;
  readonly sms: RecordingSmsSender;
  readonly registry: FakeCompanyRegistry;
  readonly vatRegistry: FakeVatRegistry;
  readonly payouts: FakePayoutProvider;
}

/**
 * The real application on the test database. Only what leaves the API is replaced:
 * the outgoing email and SMS, the registers of companies and of VAT numbers and the payment provider.
 */
export async function createTestApp(): Promise<TestApp> {
  const mail = new RecordingMailSender();
  const sms = new RecordingSmsSender();
  const registry = new FakeCompanyRegistry();
  const vatRegistry = new FakeVatRegistry();
  const payouts = new FakePayoutProvider();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailSender)
    .useValue(mail)
    .overrideProvider(SmsSender)
    .useValue(sms)
    .overrideProvider(CompanyRegistry)
    .useValue(registry)
    .overrideProvider(VatRegistry)
    .useValue(vatRegistry)
    .overrideProvider(PayoutProvider)
    .useValue(payouts)
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>({ logger: false });

  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService), mail, sms, registry, vatRegistry, payouts };
}

/** Empties every table, so each test starts from nothing. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const names = tables.map(({ tablename }) => `"${tablename}"`).join(', ');

  // Table names come from the database catalog, not from user input.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} CASCADE`);
}
