-- CreateTable
CREATE TABLE "images" (
    "id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "copy_widths" INTEGER[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "images_uploaded_by_id_idx" ON "images"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "images" ADD CONSTRAINT "images_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- A photo has a size and at least one stored copy.
ALTER TABLE "images" ADD CONSTRAINT "images_size_and_copies_valid" CHECK ("width" > 0 AND "height" > 0 AND cardinality("copy_widths") > 0);
