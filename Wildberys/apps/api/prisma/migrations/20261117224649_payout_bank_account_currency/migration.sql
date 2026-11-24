-- AlterTable
ALTER TABLE "seller_payout_accounts" ADD COLUMN     "bank_account_currency" "currency";

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- A bank account saved before the currency was asked for is a Czech one in crowns: nothing else could be given then.
UPDATE "seller_payout_accounts" SET "bank_account_currency" = 'CZK' WHERE "bank_account_holder" IS NOT NULL;

-- A bank account is given whole or not at all. The rule now counts its currency too.
ALTER TABLE "seller_payout_accounts" DROP CONSTRAINT "seller_payout_accounts_bank_account_whole";
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_bank_account_whole" CHECK (
  ("bank_account_holder" IS NULL AND "bank_account_country" IS NULL AND "bank_account_last4" IS NULL AND "bank_account_currency" IS NULL)
  OR ("bank_account_holder" IS NOT NULL AND "bank_account_country" IS NOT NULL AND "bank_account_last4" IS NOT NULL AND "bank_account_currency" IS NOT NULL)
);
