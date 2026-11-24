-- CreateTable
CREATE TABLE "waitlist_signups" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "locale" "locale" NOT NULL,
    "consent_version" TEXT NOT NULL,
    "consented_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_signups_email_key" ON "waitlist_signups"("email");

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- Emails are stored in lowercase, so one person cannot sign up twice with different letter case.
ALTER TABLE "waitlist_signups" ADD CONSTRAINT "waitlist_signups_email_lowercase" CHECK ("email" = lower("email"));
