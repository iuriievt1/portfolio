-- CreateTable
CREATE TABLE "audit_log_entries" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" UUID,
    "target_type" TEXT,
    "target_id" UUID,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entries_actor_id_id_idx" ON "audit_log_entries"("actor_id", "id");

-- CreateIndex
CREATE INDEX "audit_log_entries_action_id_idx" ON "audit_log_entries"("action", "id");

-- AddForeignKey
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity rules that the Prisma schema cannot express. Written by hand.

-- A target is named by its kind and its id together, or not at all.
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_target_complete" CHECK (("target_type" IS NULL) = ("target_id" IS NULL));

-- The audit log is append-only: rows cannot be changed or deleted.
CREATE FUNCTION "audit_log_entries_reject_change"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log_entries is append-only: rows cannot be changed or deleted';
END;
$$;

CREATE TRIGGER "audit_log_entries_append_only"
  BEFORE UPDATE OR DELETE ON "audit_log_entries"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_entries_reject_change"();
