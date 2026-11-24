-- CreateEnum
CREATE TYPE "company_check" AS ENUM ('COMPANY_REGISTER', 'VAT_REGISTER', 'DOCUMENTS');

-- CreateEnum
CREATE TYPE "seller_document_kind" AS ENUM ('IDENTITY_DOCUMENT', 'REGISTER_EXTRACT', 'OTHER');

-- DropIndex
DROP INDEX "sellers_status_idx";

-- The reason of a refusal becomes the message of every decision of the team. What was written stays, under the new name.
ALTER TABLE "sellers" RENAME COLUMN "rejection_reason" TO "review_message";

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "company_check" "company_check",
ADD COLUMN     "self_certified_at" TIMESTAMPTZ(3),
ADD COLUMN     "submitted_at" TIMESTAMPTZ(3);

-- Sellers registered before this column: a Czech company was read from the company register,
-- a company from another country was checked by its VAT number.
UPDATE "sellers"
SET "company_check" = (CASE WHEN "country_code" = 'CZ' THEN 'COMPANY_REGISTER' ELSE 'VAT_REGISTER' END)::"company_check";

ALTER TABLE "sellers" ALTER COLUMN "company_check" SET NOT NULL;

-- A registration sent before this column was sent, as far as the row can tell, when it last changed.
UPDATE "sellers" SET "submitted_at" = "updated_at" WHERE "status" <> 'DRAFT';

-- CreateTable
CREATE TABLE "seller_documents" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "kind" "seller_document_kind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_documents_seller_id_idx" ON "seller_documents"("seller_id");

-- CreateIndex
CREATE INDEX "seller_documents_uploaded_by_id_idx" ON "seller_documents"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "sellers_status_submitted_at_idx" ON "sellers"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A seller that left the draft was sent to Bluberi at some moment,
-- and its owner promised to offer only goods that comply with the law of the EU.
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_sent_with_date_and_promise" CHECK (
  "status" = 'DRAFT' OR ("submitted_at" IS NOT NULL AND "self_certified_at" IS NOT NULL)
);

-- The team says which documents it asks for and why it refuses a seller.
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_decision_with_message" CHECK (
  "status" NOT IN ('DOCUMENTS_REQUESTED', 'REJECTED') OR "review_message" IS NOT NULL
);

-- A stored file is never empty.
ALTER TABLE "seller_documents" ADD CONSTRAINT "seller_documents_size_positive" CHECK ("size_bytes" > 0);
