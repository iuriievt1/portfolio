-- The languages are Czech and English, Russian is removed.
-- The migration stops when a row still uses 'ru'. Nothing is converted silently.

-- AlterEnum
BEGIN;
CREATE TYPE "locale_new" AS ENUM ('cs', 'en');
ALTER TABLE "public"."users" ALTER COLUMN "locale" DROP DEFAULT;
ALTER TABLE "markets" ALTER COLUMN "default_locale" TYPE "locale_new" USING ("default_locale"::text::"locale_new");
ALTER TABLE "category_translations" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TABLE "attribute_translations" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TABLE "attribute_option_translations" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TABLE "product_translations" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TABLE "users" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TABLE "one_time_codes" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TABLE "orders" ALTER COLUMN "locale" TYPE "locale_new" USING ("locale"::text::"locale_new");
ALTER TYPE "locale" RENAME TO "locale_old";
ALTER TYPE "locale_new" RENAME TO "locale";
DROP TYPE "public"."locale_old";
ALTER TABLE "users" ALTER COLUMN "locale" SET DEFAULT 'cs';
COMMIT;
