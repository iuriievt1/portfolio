-- CreateEnum
CREATE TYPE "payout_method" AS ENUM ('STRIPE', 'BANK');

-- CreateEnum
CREATE TYPE "payout_account_status" AS ENUM ('INCOMPLETE', 'PENDING', 'VERIFIED');

-- DropIndex
DROP INDEX "sellers_stripe_account_id_key";

-- AlterTable
ALTER TABLE "sellers" DROP COLUMN "stripe_account_id",
ADD COLUMN     "terms_accepted_at" TIMESTAMPTZ(3) NOT NULL;

-- AlterTable
ALTER TABLE "stores" DROP COLUMN "logo_file_key",
ADD COLUMN     "logo_image_id" UUID;

-- CreateTable
CREATE TABLE "seller_payout_accounts" (
    "seller_id" UUID NOT NULL,
    "method" "payout_method" NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "status" "payout_account_status" NOT NULL DEFAULT 'INCOMPLETE',
    "submitted_at" TIMESTAMPTZ(3),
    "bank_account_holder" TEXT,
    "bank_account_country" CHAR(2),
    "bank_account_last4" CHAR(4),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "seller_payout_accounts_pkey" PRIMARY KEY ("seller_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_payout_accounts_provider_account_id_key" ON "seller_payout_accounts"("provider_account_id");

-- CreateIndex
CREATE INDEX "stores_logo_image_id_idx" ON "stores"("logo_image_id");

-- AddForeignKey
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_logo_image_id_fkey" FOREIGN KEY ("logo_image_id") REFERENCES "images"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- A bank account is given whole or not at all.
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_bank_account_whole" CHECK (
  ("bank_account_holder" IS NULL AND "bank_account_country" IS NULL AND "bank_account_last4" IS NULL)
  OR ("bank_account_holder" IS NOT NULL AND "bank_account_country" IS NOT NULL AND "bank_account_last4" IS NOT NULL)
);

-- Only the bank method keeps a bank account here. With Stripe the seller looks after it at Stripe.
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_bank_account_method" CHECK ("method" = 'BANK' OR "bank_account_holder" IS NULL);

-- The country of an IBAN is two capital letters. Its last four characters are capital letters or digits.
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_bank_account_format" CHECK ("bank_account_country" ~ '^[A-Z]{2}$' AND "bank_account_last4" ~ '^[A-Z0-9]{4}$');

-- The form of the provider is finished at a known time.
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_submitted_at" CHECK (("status" = 'INCOMPLETE') = ("submitted_at" IS NULL));

-- With the bank method the form cannot be finished before the bank account is given.
ALTER TABLE "seller_payout_accounts" ADD CONSTRAINT "seller_payout_accounts_bank_account_first" CHECK ("method" <> 'BANK' OR "status" = 'INCOMPLETE' OR "bank_account_holder" IS NOT NULL);
