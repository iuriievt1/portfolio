-- CreateEnum
CREATE TYPE "sign_in_confirmation_channel" AS ENUM ('EMAIL', 'SMS');

-- AlterEnum
ALTER TYPE "one_time_code_purpose" ADD VALUE 'CONFIRM_SIGN_IN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sign_in_confirmation_channel" "sign_in_confirmation_channel" NOT NULL DEFAULT 'EMAIL';

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- A code can go by SMS only to a confirmed phone number.
ALTER TABLE "users" ADD CONSTRAINT "users_sms_confirmation_needs_phone" CHECK ("sign_in_confirmation_channel" <> 'SMS' OR ("phone" IS NOT NULL AND "phone_verified_at" IS NOT NULL));
