-- The waitlist became a sign-up for news by email. The table and what belongs to it get
-- the new name. Written by hand, so the rows stay: a generated migration would drop the table.
ALTER TABLE "waitlist_signups" RENAME TO "newsletter_subscriptions";

ALTER TABLE "newsletter_subscriptions" RENAME CONSTRAINT "waitlist_signups_pkey" TO "newsletter_subscriptions_pkey";

ALTER TABLE "newsletter_subscriptions" RENAME CONSTRAINT "waitlist_signups_email_lowercase" TO "newsletter_subscriptions_email_lowercase";

ALTER INDEX "waitlist_signups_email_key" RENAME TO "newsletter_subscriptions_email_key";
