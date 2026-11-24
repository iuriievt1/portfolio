-- CreateEnum
CREATE TYPE "seller_conversation_topic" AS ENUM ('REGISTRATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "seller_message_side" AS ENUM ('TEAM', 'SELLER');

-- CreateEnum
CREATE TYPE "seller_message_kind" AS ENUM ('TEXT', 'DOCUMENTS_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "seller_conversations" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "topic" "seller_conversation_topic" NOT NULL,
    "subject" TEXT NOT NULL,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "side" "seller_message_side" NOT NULL,
    "kind" "seller_message_kind" NOT NULL DEFAULT 'TEXT',
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seller_conversations_seller_id_last_message_at_idx" ON "seller_conversations"("seller_id", "last_message_at");

-- CreateIndex
CREATE INDEX "seller_conversations_last_message_at_idx" ON "seller_conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "seller_messages_conversation_id_id_idx" ON "seller_messages"("conversation_id", "id");

-- CreateIndex
CREATE INDEX "seller_messages_author_id_idx" ON "seller_messages"("author_id");

-- AddForeignKey
ALTER TABLE "seller_conversations" ADD CONSTRAINT "seller_conversations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_messages" ADD CONSTRAINT "seller_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "seller_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_messages" ADD CONSTRAINT "seller_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A conversation somebody opened has a subject. Only the one about the registration is named by the apps.
ALTER TABLE "seller_conversations" ADD CONSTRAINT "seller_conversations_subject_unless_registration" CHECK (
  "topic" = 'REGISTRATION' OR length(btrim("subject")) > 0
);

-- Only an approval needs no words. Every other message says something.
ALTER TABLE "seller_messages" ADD CONSTRAINT "seller_messages_body_unless_approval" CHECK (
  "kind" = 'APPROVED' OR length(btrim("body")) > 0
);

-- A decision about a seller is made by the team.
ALTER TABLE "seller_messages" ADD CONSTRAINT "seller_messages_decision_by_team" CHECK (
  "kind" = 'TEXT' OR "side" = 'TEAM'
);
