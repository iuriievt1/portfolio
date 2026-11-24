import type { Currency, PayoutAccountStatus, PayoutMethod } from '../generated/prisma/enums.js';

export interface BankAccountDetails {
  /** Capital letters and digits without spaces. */
  readonly iban: string;
  /** The name the account is held under. */
  readonly holderName: string;
  /** The currency the account is held in. */
  readonly currency: Currency;
}

/** The account as the provider needs it to say where its check stands. */
export interface AccountToCheck {
  readonly id: string;
  /** When the seller finished the form of the provider. */
  readonly submittedAt: Date;
}

/** What the provider answers about an account whose form is finished. */
export type AccountCheckResult = Exclude<PayoutAccountStatus, 'INCOMPLETE'>;

/**
 * The payment provider that checks sellers and pays them. The rest of the API depends on this class,
 * not on Stripe. Bluberi never holds the money of a seller and never keeps a whole bank account number.
 */
export abstract class PayoutProvider {
  /** Opens the account the payouts of a seller go through. Returns its id at the provider. */
  abstract openAccount(method: PayoutMethod, sellerId: string): Promise<string>;

  /** Closes an account that was never paid to: the seller chose the other way of getting paid. */
  abstract closeAccount(accountId: string): Promise<void>;

  /** Gives the provider the bank account the payouts go to. */
  abstract saveBankAccount(accountId: string, bankAccount: BankAccountDetails): Promise<void>;

  /** Where the check of the account stands. Asked when the seller finishes the form and while the check runs. */
  abstract checkAccount(account: AccountToCheck): Promise<AccountCheckResult>;
}
