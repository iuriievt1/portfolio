-- CreateTable
CREATE TABLE "seller_pre_registrations" (
    "id" UUID NOT NULL,
    "store_name" TEXT NOT NULL,
    "ico" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locale" "locale" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_pre_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_pre_registrations_ico_key" ON "seller_pre_registrations"("ico");

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- A company number (IČO) is eight digits.
ALTER TABLE "seller_pre_registrations" ADD CONSTRAINT "seller_pre_registrations_ico_format" CHECK ("ico" ~ '^[0-9]{8}$');

-- Emails are stored in lowercase, like everywhere else.
ALTER TABLE "seller_pre_registrations" ADD CONSTRAINT "seller_pre_registrations_email_lowercase" CHECK ("email" = lower("email"));

-- Phones are stored in the international format: a plus sign, then 7 to 15 digits.
ALTER TABLE "seller_pre_registrations" ADD CONSTRAINT "seller_pre_registrations_phone_format" CHECK ("phone" ~ '^\+[1-9][0-9]{6,14}$');
